/**
 * @fileoverview Invoices API
 *
 * Coach-facing endpoint to create (and finalize) real invoices for a client via
 * the Stripe Invoices API, using DIRECT CHARGE on the coach's connected account.
 *
 * - POST `/api/invoices` — create + finalize an invoice for a client.
 * - GET  `/api/invoices` — list the authenticated coach's invoices (optionally
 *   scoped to a single client), newest first.
 *
 * ## Money
 * All monetary amounts are integer CENTS. The platform retains a 2% fee on every
 * invoice (`application_fee_amount`, set by the lib wrapper at draft time).
 *
 * ## Gating (Connect hardening)
 * A coach may only issue invoices when the connected account exists
 * (`stripeAccountId`) and `chargesEnabled` is true. Status sync after finalize
 * (paid/void/uncollectible) is handled by the Stripe webhook.
 *
 * @module api/invoices
 */

import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { invoices, coachClientBilling, coachProfiles, users } from '@/db/schema';
import { rateLimit, WRITE_LIMIT, FREQUENT_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import {
  getOrCreateCustomer,
  createDraftInvoice,
  addInvoiceItem,
  finalizeInvoice,
  computePlatformFeeCents,
  DEFAULT_INVOICE_CURRENCY,
  DEFAULT_DAYS_UNTIL_DUE,
} from '@/lib/stripe-invoices';
import type { Invoice as DbInvoice } from '@/db/schema';

// ============================================================================
// VALIDATION
// ============================================================================

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amountCents: z.number().int().positive(),
  quantity: z.number().int().positive().max(1000).optional().default(1),
});

const createInvoiceSchema = z.object({
  clientId: z.string().trim().min(1),
  items: z.array(invoiceItemSchema).min(1).max(50),
  currency: z.string().trim().toLowerCase().length(3).optional().default(DEFAULT_INVOICE_CURRENCY),
  description: z.string().trim().max(2000).optional(),
  daysUntilDue: z.number().int().min(0).max(365).optional().default(DEFAULT_DAYS_UNTIL_DUE),
  bookingId: z.number().int().positive().optional(),
});

const ALLOWED_STATUSES = ['draft', 'open', 'paid', 'void', 'uncollectible'] as const;
type InvoiceStatus = (typeof ALLOWED_STATUSES)[number];

function mapStripeStatus(status: string | null | undefined): InvoiceStatus {
  return (ALLOWED_STATUSES as readonly string[]).includes(status ?? '')
    ? (status as InvoiceStatus)
    : 'open';
}

/** Serializes a DB invoice row into the API response shape. */
function serializeInvoice(row: DbInvoice) {
  return {
    id: row.id,
    stripeInvoiceId: row.stripeInvoiceId,
    stripeCustomerId: row.stripeCustomerId,
    status: row.status,
    amountTotalCents: row.amountTotalCents,
    applicationFeeCents: row.applicationFeeCents,
    currency: row.currency,
    invoiceNumber: row.invoiceNumber,
    hostedInvoiceUrl: row.hostedInvoiceUrl,
    invoicePdfUrl: row.invoicePdfUrl,
    description: row.description,
    dueDate: row.dueDate,
    finalizedAt: row.finalizedAt,
    paidAt: row.paidAt,
    voidedAt: row.voidedAt,
    coachId: row.coachId,
    clientId: row.clientId,
    bookingId: row.bookingId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ============================================================================
// POST /api/invoices — create + finalize an invoice for a client
// ============================================================================

export async function POST(request: Request) {
  // Rate limit: 10 requests per minute (mutation).
  const rl = rateLimit(request, WRITE_LIMIT, 'invoices-create');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  // Parse + validate body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 }
    );
  }

  const { clientId, items, currency, description, daysUntilDue, bookingId } = parsed.data;

  // Compute the invoice total from the line items (integer cents).
  const totalCents = items.reduce((sum, item) => sum + item.amountCents * item.quantity, 0);
  if (totalCents <= 0) {
    return Response.json(
      {
        success: false,
        error: { code: 'INVALID_AMOUNT', message: 'Invoice total must be greater than zero' },
      },
      { status: 400 }
    );
  }

  try {
    // Gating: the caller must be a coach with a Connect account that can charge.
    const coachProfile = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.userId, userId),
      columns: { userId: true, stripeAccountId: true, chargesEnabled: true },
    });

    if (!coachProfile) {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can create invoices' },
        },
        { status: 403 }
      );
    }

    if (!coachProfile.stripeAccountId || !coachProfile.chargesEnabled) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'STRIPE_NOT_READY',
            message: 'Complete your Stripe onboarding before issuing invoices',
          },
        },
        { status: 409 }
      );
    }

    const stripeAccountId = coachProfile.stripeAccountId;

    // The client must exist and have an email (required to create a Stripe Customer).
    const client = await db.query.users.findFirst({
      where: eq(users.id, clientId),
      columns: { id: true, email: true, name: true },
    });

    if (!client) {
      return Response.json(
        { success: false, error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } },
        { status: 404 }
      );
    }

    if (!client.email) {
      return Response.json(
        {
          success: false,
          error: { code: 'CLIENT_NO_EMAIL', message: 'Client has no email on file' },
        },
        { status: 400 }
      );
    }

    // --- Stripe direct-charge flow (all on the coach's connected account) ---
    let dbInvoice: DbInvoice;
    try {
      // 1. Resolve the Stripe Customer, reusing the cached id when available.
      const cachedBilling = await db.query.coachClientBilling.findFirst({
        where: and(
          eq(coachClientBilling.coachId, userId),
          eq(coachClientBilling.clientId, clientId)
        ),
        columns: { id: true, stripeCustomerId: true },
      });

      const customer = await getOrCreateCustomer({
        stripeAccountId,
        email: client.email,
        name: client.name ?? undefined,
        customerId: cachedBilling?.stripeCustomerId,
        metadata: { coachId: userId, clientId },
      });

      // Cache the resolved customer id for next time (create or refresh).
      if (!cachedBilling) {
        await db
          .insert(coachClientBilling)
          .values({ coachId: userId, clientId, stripeCustomerId: customer.id })
          .onConflictDoNothing({
            target: [coachClientBilling.coachId, coachClientBilling.clientId],
          });
      } else if (cachedBilling.stripeCustomerId !== customer.id) {
        await db
          .update(coachClientBilling)
          .set({ stripeCustomerId: customer.id })
          .where(eq(coachClientBilling.id, cachedBilling.id));
      }

      // 2. Create the draft invoice (2% application fee set by the wrapper).
      const draft = await createDraftInvoice({
        stripeAccountId,
        customerId: customer.id,
        totalCents,
        currency,
        description,
        daysUntilDue,
        metadata: {
          coachId: userId,
          clientId,
          ...(bookingId ? { bookingId: String(bookingId) } : {}),
        },
      });

      if (!draft.id) {
        throw new Error('Stripe did not return a draft invoice id');
      }

      // 3. Attach each line item.
      for (const item of items) {
        await addInvoiceItem({
          stripeAccountId,
          customerId: customer.id,
          invoiceId: draft.id,
          amountCents: item.amountCents,
          quantity: item.quantity,
          description: item.description,
          currency,
        });
      }

      // 4. Finalize → assigns number, generates PDF + hosted url.
      const finalized = await finalizeInvoice({ stripeAccountId, invoiceId: draft.id });

      // 5. Persist the invoice row. Status is kept in sync by the webhook afterwards.
      const status = mapStripeStatus(finalized.status);
      const dueDate = finalized.due_date ? new Date(finalized.due_date * 1000) : null;

      const [row] = await db
        .insert(invoices)
        .values({
          coachId: userId,
          clientId,
          bookingId: bookingId ?? null,
          stripeInvoiceId: finalized.id ?? draft.id,
          stripeCustomerId: customer.id,
          status,
          amountTotalCents: totalCents,
          applicationFeeCents: computePlatformFeeCents(totalCents),
          currency,
          invoiceNumber: finalized.number ?? null,
          hostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
          invoicePdfUrl: finalized.invoice_pdf ?? null,
          description: description ?? null,
          dueDate,
          finalizedAt: new Date(),
        })
        .returning();

      dbInvoice = row;
    } catch (stripeError) {
      console.error('[Invoices] Stripe error creating invoice:', stripeError);
      return Response.json(
        {
          success: false,
          error: {
            code: 'STRIPE_ERROR',
            message: 'Failed to create the invoice with Stripe. Please try again.',
          },
        },
        { status: 502 }
      );
    }

    return Response.json({ success: true, data: serializeInvoice(dbInvoice) }, { status: 201 });
  } catch (error) {
    console.error('[Invoices] Error creating invoice:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create invoice' } },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET /api/invoices — list the authenticated coach's invoices
// ============================================================================

export async function GET(request: Request) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'invoices-list');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();
  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const offset = (page - 1) * limit;

    // Multi-tenant scope: always restrict to the authenticated coach.
    const conditions = [eq(invoices.coachId, userId)];
    if (clientId) {
      conditions.push(eq(invoices.clientId, clientId));
    }
    const where = and(...conditions);

    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(invoices)
        .where(where),
      db
        .select()
        .from(invoices)
        .where(where)
        .orderBy(desc(invoices.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.count ?? 0;

    return Response.json({
      success: true,
      data: {
        invoices: rows.map(serializeInvoice),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Invoices] Error listing invoices:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch invoices' } },
      { status: 500 }
    );
  }
}
