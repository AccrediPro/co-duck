/**
 * @fileoverview Thin, strongly-typed wrapper over the Stripe Invoices API using
 * DIRECT CHARGE on a coach's connected account.
 *
 * @module lib/stripe-invoices
 *
 * ## Direct charge model
 *
 * Every call in this module targets the coach's connected account by passing
 * `{ stripeAccount }` as the Stripe request option. The Customer, Invoice and
 * InvoiceItem objects therefore live ON the connected account, not the platform.
 *
 * ## Platform fee
 *
 * Co-duck retains a 2% platform fee on every invoice payment (Dave's binding
 * decision, 2026-06-14). This is applied via `application_fee_amount` on the
 * invoice. The existing bookings fee (10%/5%) is unrelated and untouched.
 *
 * ## Money
 *
 * All monetary amounts are integer CENTS, never floats.
 *
 * ## Persistence
 *
 * This module performs NO database access. Caching the Stripe customer id
 * (`coach_client_billing`) and persisting invoice rows is the caller's job.
 *
 * @see {@link src/lib/stripe.ts | Shared Stripe client}
 * @see {@link https://stripe.com/docs/invoicing | Stripe Invoicing}
 * @see {@link https://stripe.com/docs/connect/direct-charges | Stripe direct charges}
 */

import { stripe, type Stripe } from '@/lib/stripe';

// ============================================================================
// CONSTANTS & FEE MATH
// ============================================================================

/** Platform fee rate applied to invoice payments (2%). */
export const INVOICE_PLATFORM_FEE_RATE = 0.02;

/** Default currency for invoices (US market). */
export const DEFAULT_INVOICE_CURRENCY = 'usd';

/** Default number of days a finalized invoice is due. */
export const DEFAULT_DAYS_UNTIL_DUE = 30;

/**
 * Computes the platform fee (in integer cents) for a given invoice total.
 *
 * @param totalCents - Invoice total in integer cents.
 * @returns The 2% platform fee, rounded to the nearest cent.
 */
export function computePlatformFeeCents(totalCents: number): number {
  return Math.round(totalCents * INVOICE_PLATFORM_FEE_RATE);
}

// ============================================================================
// REQUEST OPTIONS
// ============================================================================

/**
 * Builds the Stripe request options that scope a call to the coach's connected
 * account (direct charge). An optional idempotency key makes create/mutate
 * operations safe to retry.
 */
function connectedAccountOptions(
  stripeAccountId: string,
  idempotencyKey?: string
): Stripe.RequestOptions {
  return idempotencyKey
    ? { stripeAccount: stripeAccountId, idempotencyKey }
    : { stripeAccount: stripeAccountId };
}

// ============================================================================
// CUSTOMER
// ============================================================================

export interface GetOrCreateCustomerParams {
  /** The coach's connected account id (`acct_...`). */
  stripeAccountId: string;
  /** The client's email — used for lookup and on the customer record. */
  email: string;
  /** Optional display name for the customer. */
  name?: string;
  /** Cached Stripe customer id (`cus_...`) from `coach_client_billing`, if known. */
  customerId?: string;
  /** Optional metadata to attach when creating a new customer. */
  metadata?: Stripe.MetadataParam;
}

/**
 * Resolves the Stripe Customer for a client on the coach's connected account.
 *
 * Resolution order:
 * 1. If `customerId` is supplied, retrieve it directly (caller's cache hit).
 * 2. Otherwise look up an existing customer by email.
 * 3. Otherwise create a new customer.
 *
 * @returns The Stripe Customer on the connected account.
 */
export async function getOrCreateCustomer(
  params: GetOrCreateCustomerParams
): Promise<Stripe.Customer> {
  const { stripeAccountId, email, name, customerId, metadata } = params;
  const options = connectedAccountOptions(stripeAccountId);

  if (customerId) {
    const existing = await stripe.customers.retrieve(customerId, options);
    if (!existing.deleted) {
      return existing;
    }
  }

  const matches = await stripe.customers.list({ email, limit: 1 }, options);
  if (matches.data.length > 0) {
    return matches.data[0];
  }

  return stripe.customers.create(
    {
      email,
      ...(name ? { name } : {}),
      ...(metadata ? { metadata } : {}),
    },
    options
  );
}

// ============================================================================
// INVOICE — DRAFT
// ============================================================================

export interface CreateDraftInvoiceParams {
  /** The coach's connected account id (`acct_...`). */
  stripeAccountId: string;
  /** The Stripe customer id (`cus_...`) on the connected account. */
  customerId: string;
  /**
   * Expected invoice total in integer cents, used to compute the 2% platform
   * fee (`application_fee_amount`). The caller is responsible for adding line
   * items that sum to this total before finalizing.
   */
  totalCents: number;
  /** ISO 4217 currency code. Defaults to `usd`. */
  currency?: string;
  /** Optional human-readable description shown on the invoice. */
  description?: string;
  /** Days until the invoice is due once finalized. Defaults to 30. */
  daysUntilDue?: number;
  /** Optional metadata (e.g. internal invoice id, coachId, clientId). */
  metadata?: Stripe.MetadataParam;
  /** Optional idempotency key for safe retries. */
  idempotencyKey?: string;
}

/**
 * Creates a DRAFT invoice on the coach's connected account with the 2% platform
 * fee pre-set via `application_fee_amount`.
 *
 * The invoice uses `collection_method: 'send_invoice'` so Stripe can deliver it
 * and (when enabled at the account level) send automatic payment reminders. No
 * line items are attached here — call {@link addInvoiceItem} for each item, then
 * {@link finalizeInvoice}.
 */
export async function createDraftInvoice(
  params: CreateDraftInvoiceParams
): Promise<Stripe.Invoice> {
  const {
    stripeAccountId,
    customerId,
    totalCents,
    currency = DEFAULT_INVOICE_CURRENCY,
    description,
    daysUntilDue = DEFAULT_DAYS_UNTIL_DUE,
    metadata,
    idempotencyKey,
  } = params;

  return stripe.invoices.create(
    {
      customer: customerId,
      currency,
      collection_method: 'send_invoice',
      days_until_due: daysUntilDue,
      application_fee_amount: computePlatformFeeCents(totalCents),
      // Don't auto-finalize; the caller adds items and finalizes explicitly.
      auto_advance: false,
      // Only bill items explicitly attached to this invoice.
      pending_invoice_items_behavior: 'exclude',
      ...(description ? { description } : {}),
      ...(metadata ? { metadata } : {}),
    },
    connectedAccountOptions(stripeAccountId, idempotencyKey)
  );
}

// ============================================================================
// INVOICE ITEM
// ============================================================================

export interface AddInvoiceItemParams {
  /** The coach's connected account id (`acct_...`). */
  stripeAccountId: string;
  /** The Stripe customer id (`cus_...`) on the connected account. */
  customerId: string;
  /** The draft invoice id (`in_...`) to attach this item to. */
  invoiceId: string;
  /** Unit amount in integer cents. */
  amountCents: number;
  /** Line item description. */
  description: string;
  /** ISO 4217 currency code. Defaults to `usd`. */
  currency?: string;
  /** Quantity. Defaults to 1. */
  quantity?: number;
  /** Optional metadata. */
  metadata?: Stripe.MetadataParam;
  /** Optional idempotency key for safe retries. */
  idempotencyKey?: string;
}

/**
 * Adds a single line item to an existing draft invoice on the connected account.
 *
 * @returns The created Stripe InvoiceItem.
 */
export async function addInvoiceItem(params: AddInvoiceItemParams): Promise<Stripe.InvoiceItem> {
  const {
    stripeAccountId,
    customerId,
    invoiceId,
    amountCents,
    description,
    currency = DEFAULT_INVOICE_CURRENCY,
    quantity = 1,
    metadata,
    idempotencyKey,
  } = params;

  return stripe.invoiceItems.create(
    {
      customer: customerId,
      invoice: invoiceId,
      currency,
      // Unit price in integer cents (expressed as a decimal string), multiplied
      // by quantity by Stripe to produce the line total.
      unit_amount_decimal: String(amountCents),
      quantity,
      description,
      ...(metadata ? { metadata } : {}),
    },
    connectedAccountOptions(stripeAccountId, idempotencyKey)
  );
}

// ============================================================================
// INVOICE — FINALIZE / VOID / RETRIEVE
// ============================================================================

export interface FinalizeInvoiceParams {
  /** The coach's connected account id (`acct_...`). */
  stripeAccountId: string;
  /** The draft invoice id (`in_...`) to finalize. */
  invoiceId: string;
  /** Optional idempotency key for safe retries. */
  idempotencyKey?: string;
}

/**
 * Finalizes a draft invoice on the connected account.
 *
 * Finalization assigns the sequential invoice `number`, generates the
 * `invoice_pdf`, and produces the `hosted_invoice_url`. `auto_advance: true`
 * hands collection over to Stripe so that automatic payment reminders (when
 * enabled on the connected account) are sent without a custom cron.
 *
 * @returns The finalized Stripe Invoice (with `number`, `invoice_pdf`,
 *          `hosted_invoice_url`).
 */
export async function finalizeInvoice(params: FinalizeInvoiceParams): Promise<Stripe.Invoice> {
  const { stripeAccountId, invoiceId, idempotencyKey } = params;

  return stripe.invoices.finalizeInvoice(
    invoiceId,
    { auto_advance: true },
    connectedAccountOptions(stripeAccountId, idempotencyKey)
  );
}

export interface VoidInvoiceParams {
  /** The coach's connected account id (`acct_...`). */
  stripeAccountId: string;
  /** The finalized invoice id (`in_...`) to void. */
  invoiceId: string;
  /** Optional idempotency key for safe retries. */
  idempotencyKey?: string;
}

/**
 * Voids a finalized (open) invoice on the connected account. Voiding is only
 * valid for finalized invoices that have not been paid.
 *
 * @returns The voided Stripe Invoice.
 */
export async function voidInvoice(params: VoidInvoiceParams): Promise<Stripe.Invoice> {
  const { stripeAccountId, invoiceId, idempotencyKey } = params;

  return stripe.invoices.voidInvoice(
    invoiceId,
    undefined,
    connectedAccountOptions(stripeAccountId, idempotencyKey)
  );
}

export interface GetInvoiceParams {
  /** The coach's connected account id (`acct_...`). */
  stripeAccountId: string;
  /** The invoice id (`in_...`) to retrieve. */
  invoiceId: string;
}

/**
 * Retrieves an invoice from the connected account.
 *
 * @returns The Stripe Invoice.
 */
export async function getInvoice(params: GetInvoiceParams): Promise<Stripe.Invoice> {
  const { stripeAccountId, invoiceId } = params;

  return stripe.invoices.retrieve(invoiceId, connectedAccountOptions(stripeAccountId));
}
