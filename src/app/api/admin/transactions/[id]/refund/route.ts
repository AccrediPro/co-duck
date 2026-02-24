/**
 * @fileoverview Admin Refund API
 *
 * Process refunds for transactions (admin only).
 *
 * @module api/admin/transactions/[id]/refund
 */

import { db } from '@/db';
import { transactions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { stripe } from '@/lib/stripe';
import { z } from 'zod';
import { createNotification } from '@/lib/notifications';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const refundSchema = z.object({
  amountCents: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/admin/transactions/:id/refund
 *
 * Process a full or partial refund via Stripe.
 *
 * @param {string} id - Transaction ID
 * @body {number} [amountCents] - Partial refund amount in cents (omit for full refund)
 * @body {string} [reason] - Refund reason
 *
 * @returns Updated transaction
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response!;

  try {
    const { id } = await params;
    const transactionId = parseInt(id);

    if (isNaN(transactionId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid transaction ID' } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = refundSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
        },
        { status: 400 }
      );
    }

    // Get transaction
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, transactionId),
    });

    if (!transaction) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } },
        { status: 404 }
      );
    }

    if (transaction.status !== 'succeeded') {
      return Response.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot refund transaction with status: ${transaction.status}`,
          },
        },
        { status: 400 }
      );
    }

    if (!transaction.stripePaymentIntentId) {
      return Response.json(
        {
          success: false,
          error: { code: 'NO_PAYMENT_INTENT', message: 'No Stripe payment intent found' },
        },
        { status: 400 }
      );
    }

    const refundAmount = parsed.data.amountCents || transaction.amountCents;

    if (refundAmount > transaction.amountCents) {
      return Response.json(
        {
          success: false,
          error: { code: 'EXCEEDS_AMOUNT', message: 'Refund amount exceeds transaction amount' },
        },
        { status: 400 }
      );
    }

    // Process Stripe refund
    try {
      await stripe.refunds.create({
        payment_intent: transaction.stripePaymentIntentId,
        amount: refundAmount,
        reason: 'requested_by_customer',
      });
    } catch (stripeError) {
      console.error('Stripe refund failed:', stripeError);
      return Response.json(
        {
          success: false,
          error: { code: 'STRIPE_ERROR', message: 'Failed to process Stripe refund' },
        },
        { status: 500 }
      );
    }

    // Update transaction
    const [updated] = await db
      .update(transactions)
      .set({
        status: 'refunded',
        refundAmountCents: refundAmount,
      })
      .where(eq(transactions.id, transactionId))
      .returning();

    // Notify the client
    createNotification({
      userId: transaction.clientId,
      type: 'system',
      title: 'Refund processed',
      body: `A refund of $${(refundAmount / 100).toFixed(2)} has been processed for your booking.`,
      link: `/dashboard/my-sessions`,
    });

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        amountCents: updated.amountCents,
        refundAmountCents: updated.refundAmountCents,
      },
    });
  } catch (error) {
    console.error('Error processing admin refund:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process refund' } },
      { status: 500 }
    );
  }
}
