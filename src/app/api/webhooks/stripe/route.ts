/**
 * @fileoverview Stripe Webhook Handler
 *
 * This module handles incoming webhook events from Stripe to synchronize
 * payment state with the application database. It processes three key events:
 *
 * 1. `checkout.session.completed` - When a customer successfully pays
 * 2. `checkout.session.expired` - When a checkout session times out
 * 3. `payment_intent.payment_failed` - When a payment attempt fails
 *
 * ## Security
 * All incoming requests are verified using Stripe's webhook signature
 * verification to prevent spoofed events.
 *
 * ## Idempotency
 * Handlers are designed to be idempotent - processing the same event
 * multiple times will not create duplicate records or corrupt state.
 *
 * @module api/webhooks/stripe
 */

import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { db, bookings, transactions, users, coachProfiles } from '@/db';
import { memberships, membershipSubscriptions } from '@/db/schema';
import { packages, packagePurchases, coachSubscriptions } from '@/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import type Stripe from 'stripe';
import { getOrCreateConversationInternal, sendSystemMessage } from '@/lib/conversations';
import type { BookingSessionType } from '@/db/schema';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';
import {
  PaymentReceiptEmail,
  BookingRequestCoachEmail,
  BookingRequestClientEmail,
} from '@/lib/emails';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';
import { formatDateLong, formatTime } from '@/lib/date-utils';

/**
 * Retrieves the Stripe webhook secret from environment variables.
 *
 * The webhook secret is used to verify that incoming webhook requests
 * actually originated from Stripe and haven't been tampered with.
 *
 * @returns The STRIPE_WEBHOOK_SECRET environment variable value
 * @throws {Error} If STRIPE_WEBHOOK_SECRET is not configured
 *
 * @example
 * const secret = getWebhookSecret();
 * stripe.webhooks.constructEvent(body, signature, secret);
 */
function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is not set. Please add it to your .env.local file. ' +
        'Create a webhook in the Stripe Dashboard pointing to /api/webhooks/stripe'
    );
  }

  return secret;
}

/**
 * POST /api/webhooks/stripe
 *
 * Handles incoming Stripe webhook events. This is the main entry point
 * for all Stripe webhook notifications.
 *
 * ## Flow
 * 1. Extract and verify the webhook signature
 * 2. Parse the event payload
 * 3. Route to appropriate handler based on event type
 * 4. Return appropriate status code
 *
 * ## Response Codes
 * - 200: Event processed successfully (or logged and ignored)
 * - 400: Invalid signature or malformed request
 *
 * ## Important Notes
 * - Returns 200 even for handler errors to prevent Stripe retries
 * - Errors are logged for debugging but don't block the response
 * - Unhandled event types are logged but return 200
 *
 * @param req - The incoming HTTP request from Stripe
 * @returns Response with appropriate status code
 */
export async function POST(req: Request) {
  let event: Stripe.Event;

  try {
    // Get the raw body as text for signature verification
    // Note: We use req.text() instead of req.json() because Stripe signature
    // verification requires the raw body bytes exactly as received
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('Stripe webhook: Missing stripe-signature header');
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    // Verify the webhook signature using Stripe's SDK
    // This ensures the request actually came from Stripe and hasn't been modified
    try {
      event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret());
    } catch (err) {
      const error = err as Error;
      console.error('Stripe webhook signature verification failed:', error.message);
      return new Response(`Webhook signature verification failed: ${error.message}`, {
        status: 400,
      });
    }
  } catch (err) {
    const error = err as Error;
    console.error('Stripe webhook error parsing request:', error.message);
    return new Response('Error parsing request', { status: 400 });
  }

  // Route to appropriate handler based on event type
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // Customer successfully completed payment
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'checkout.session.expired': {
        // Checkout session timed out (30 min default) without payment
        await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'payment_intent.payment_failed': {
        // Payment attempt failed (card declined, insufficient funds, etc.)
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      }

      case 'account.application.deauthorized': {
        // Coach disconnected their Stripe Connect account
        await handleConnectDeauthorized(event.account as string);
        break;
      }

      // ---- Package purchase (P0-05) ----
      // checkout.session.completed is already handled above but dispatches
      // to handlePackageCheckoutCompleted when metadata.type === 'package'

      // ---- Subscription events ----
      // Two distinct subscription products share the Stripe subscription.*
      // event stream:
      //   • Coach SaaS tier subscriptions (P0-07) — handleSubscriptionUpserted
      //   • Client membership retainers (P0-06)  — handleMembershipSubscriptionUpsert
      // Each handler checks its own metadata shape and no-ops when the event
      // belongs to the other product, so it's safe to fan out to both.
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        await handleSubscriptionUpserted(event.data.object as Stripe.Subscription);
        await handleMembershipSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        await handleMembershipSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        // Period renewal or first charge. Resets the session allotment.
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      }

      case 'invoice.payment_failed': {
        // Flip to past_due; grace window handled via subscription.updated.
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      }

      default:
        // Log unhandled event types for monitoring
        // This helps identify if we need to handle new event types
        console.log(`Stripe webhook: Unhandled event type: ${event.type}`);
    }

    return new Response('Webhook processed', { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error(`Stripe webhook error handling ${event.type}:`, error.message);
    // Return 200 to prevent Stripe from retrying (we've logged the error for debugging)
    // Returning 500 would cause Stripe to retry the webhook, which could lead to
    // duplicate processing attempts. For critical errors that should be retried,
    // you might want to return 500 instead.
    return new Response('Webhook handler error', { status: 200 });
  }
}

/**
 * Handles the checkout.session.completed event.
 *
 * This is the primary success path for payments. When a customer successfully
 * completes the Stripe Checkout flow, this handler:
 *
 * 1. Validates the booking ID from session metadata
 * 2. Confirms the payment was successful (status = 'paid')
 * 3. Updates booking status from 'pending' to 'confirmed'
 * 4. Creates a transaction record with fee calculations
 * 5. Initiates a system message in the coach-client conversation
 *
 * ## Idempotency
 * - Checks if transaction already exists before creating
 * - Only updates bookings still in 'pending' status
 * - Safe to receive multiple times for the same event
 *
 * ## Fee Structure
 * - Platform fee: 10% of total
 * - Coach payout: 90% of total
 *
 * @param session - The Stripe Checkout Session object from the event
 *
 * @example
 * // Session metadata should include:
 * // - bookingId: The database booking ID
 * // - coachId: The Clerk user ID of the coach
 * // - clientId: The Clerk user ID of the client
 * // - sessionPrice: Original price in cents (fallback if amount_total missing)
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log(`Stripe webhook: checkout.session.completed for session ${session.id}`);

  // Dispatch to package handler if this is a package purchase
  if (session.metadata?.type === 'package') {
    await handlePackageCheckoutCompleted(session);
    return;
  }

  // Subscription-mode checkouts (memberships P0-06 and coach SaaS P0-07) are
  // handled entirely by customer.subscription.* and invoice.* events —
  // nothing to do here.
  if (session.mode === 'subscription' || session.metadata?.type === 'subscription') {
    console.log(
      `Stripe webhook: checkout.session.completed in subscription mode — ` +
        `deferring to subscription events`
    );
    return;
  }

  // Get booking ID from metadata
  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    console.error('Stripe webhook: No bookingId in checkout session metadata');
    return;
  }

  const bookingIdNum = parseInt(bookingId, 10);

  if (isNaN(bookingIdNum)) {
    console.error(`Stripe webhook: Invalid bookingId: ${bookingId}`);
    return;
  }

  // Check if payment was successful
  if (session.payment_status !== 'paid') {
    console.log(
      `Stripe webhook: Payment status is ${session.payment_status}, not 'paid'. Skipping.`
    );
    return;
  }

  // Get existing booking
  const existingBooking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingIdNum))
    .limit(1);

  if (existingBooking.length === 0) {
    console.error(`Stripe webhook: Booking ${bookingIdNum} not found`);
    return;
  }

  const booking = existingBooking[0];

  // Booking approval flow: keep booking as 'pending' after payment.
  // The coach must explicitly accept or reject the booking.
  if (booking.status !== 'pending') {
    console.log(
      `Stripe webhook: Booking ${bookingIdNum} already has status '${booking.status}', skipping`
    );
  } else {
    console.log(`Stripe webhook: Booking ${bookingIdNum} paid — awaiting coach approval`);
  }

  // Check if transaction already exists (avoid duplicates from success page + webhook)
  const existingTransaction = await db
    .select()
    .from(transactions)
    .where(eq(transactions.stripeCheckoutSessionId, session.id))
    .limit(1);

  if (existingTransaction.length > 0) {
    console.log(`Stripe webhook: Transaction already exists for session ${session.id}`);
    return;
  }

  // Get payment intent ID
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

  // Extract metadata values
  const coachId = session.metadata?.coachId;
  const clientId = session.metadata?.clientId;
  const sessionPrice = session.metadata?.sessionPrice;

  if (!coachId || !clientId) {
    console.error('Stripe webhook: Missing coachId or clientId in metadata');
    return;
  }

  // Calculate amounts
  const amountTotal = session.amount_total || parseInt(sessionPrice || '0', 10);
  const platformFeeCents = Math.round(amountTotal * 0.1);
  const coachPayoutCents = amountTotal - platformFeeCents;
  const currency = session.currency || 'usd';

  // Create transaction record
  const [newTransaction] = await db
    .insert(transactions)
    .values({
      bookingId: bookingIdNum,
      coachId,
      clientId,
      amountCents: amountTotal,
      currency: currency.toLowerCase(),
      platformFeeCents,
      coachPayoutCents,
      stripePaymentIntentId: paymentIntentId || null,
      stripeCheckoutSessionId: session.id,
      status: 'succeeded',
    })
    .returning();

  console.log(`Stripe webhook: Transaction created for booking ${bookingIdNum}`);

  // Send booking request emails (approval flow)
  const sessionType = booking.sessionType as BookingSessionType;
  const [clientUser, coachUser] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, clientId) }),
    db.query.users.findFirst({ where: eq(users.id, coachId) }),
  ]);

  const sessionName = sessionType?.name || 'Coaching session';
  const formattedDate = formatDateLong(booking.startTime);
  const formattedTime = formatTime(booking.startTime);
  const priceFormatted = amountTotal / 100;

  // Send payment receipt to client (still relevant — they paid)
  if (clientUser?.email && coachUser) {
    sendEmail({
      to: clientUser.email,
      subject: `Payment receipt for ${sessionName} with ${coachUser.name || 'your coach'}`,
      react: PaymentReceiptEmail({
        clientName: clientUser.name || 'there',
        coachName: coachUser.name || 'Your Coach',
        sessionType: sessionName,
        sessionDate: formattedDate,
        sessionTime: formattedTime,
        duration: sessionType?.duration || 60,
        amountCents: amountTotal,
        currency,
        transactionId: newTransaction.id,
        bookingId: bookingIdNum,
        unsubscribeUrl: getUnsubscribeUrl(clientId, 'bookings'),
      }),
    }).catch((err) => console.error('Failed to send payment receipt email:', err));
  }

  // Send booking request email to coach
  if (coachUser?.email && clientUser) {
    sendEmail({
      to: coachUser.email,
      subject: `New booking request from ${clientUser.name || 'a client'}`,
      react: BookingRequestCoachEmail({
        coachName: coachUser.name || 'Coach',
        clientName: clientUser.name || 'A client',
        sessionType: sessionName,
        date: formattedDate,
        time: formattedTime,
        duration: sessionType?.duration || 60,
        price: priceFormatted,
        bookingId: bookingIdNum,
        unsubscribeUrl: getUnsubscribeUrl(coachId, 'bookings'),
      }),
    }).catch((err) => console.error('Failed to send booking request email to coach:', err));
  }

  // Send booking submitted email to client
  if (clientUser?.email && coachUser) {
    sendEmail({
      to: clientUser.email,
      subject: `Booking request submitted — awaiting ${coachUser.name || 'coach'} approval`,
      react: BookingRequestClientEmail({
        clientName: clientUser.name || 'there',
        coachName: coachUser.name || 'Your Coach',
        sessionType: sessionName,
        date: formattedDate,
        time: formattedTime,
        duration: sessionType?.duration || 60,
        price: priceFormatted,
        unsubscribeUrl: getUnsubscribeUrl(clientId, 'bookings'),
      }),
    }).catch((err) => console.error('Failed to send booking request email to client:', err));
  }

  // Create system message in conversation: booking request pending
  const conversationResult = await getOrCreateConversationInternal(coachId, clientId);
  if (conversationResult.success) {
    sendSystemMessage(
      conversationResult.conversationId,
      `Booking request: ${sessionName} on ${formattedDate} at ${formattedTime} — awaiting coach approval`,
      clientId
    ).catch((error) => {
      console.error('Stripe webhook: Error creating booking request system message:', error);
    });
  }

  // Notify coach about new booking request
  createNotification({
    userId: coachId,
    type: 'booking_confirmed',
    title: 'New booking request',
    body: `${clientUser?.name || 'A client'} has requested a ${sessionName}. Please accept or decline.`,
    link: `/dashboard/sessions/${bookingIdNum}`,
  });

  // Notify client that request is pending
  createNotification({
    userId: clientId,
    type: 'booking_confirmed',
    title: 'Booking request submitted',
    body: `Your ${sessionName} request has been submitted. ${coachUser?.name || 'Your coach'} will review it shortly.`,
    link: `/dashboard/my-sessions/${bookingIdNum}`,
  });

  // NOTE: Calendar sync is deferred until coach accepts the booking
}

/**
 * Handles the checkout.session.expired event.
 *
 * When a Stripe Checkout session expires (default 30 minutes) without
 * the customer completing payment, this handler cancels the associated
 * booking to free up the coach's time slot.
 *
 * ## Behavior
 * - Only cancels bookings still in 'pending' status
 * - Sets cancellation reason to 'Payment session expired'
 * - Records cancellation timestamp
 * - Safe to receive multiple times (idempotent)
 *
 * ## Time Slot Management
 * By cancelling expired bookings, we ensure that time slots that were
 * temporarily held during checkout become available again for other clients.
 *
 * @param session - The expired Stripe Checkout Session object
 */
async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  console.log(`Stripe webhook: checkout.session.expired for session ${session.id}`);

  // Get booking ID from metadata
  const bookingId = session.metadata?.bookingId;

  if (!bookingId) {
    console.log('Stripe webhook: No bookingId in expired session metadata');
    return;
  }

  const bookingIdNum = parseInt(bookingId, 10);

  if (isNaN(bookingIdNum)) {
    console.error(`Stripe webhook: Invalid bookingId: ${bookingId}`);
    return;
  }

  // Get existing booking
  const existingBooking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingIdNum))
    .limit(1);

  if (existingBooking.length === 0) {
    console.log(`Stripe webhook: Booking ${bookingIdNum} not found (may have been deleted)`);
    return;
  }

  const booking = existingBooking[0];

  // Only cancel if booking is still pending (user hasn't paid via another method)
  if (booking.status === 'pending') {
    await db
      .update(bookings)
      .set({
        status: 'cancelled',
        cancellationReason: 'Payment session expired',
        cancelledAt: new Date(),
      })
      .where(eq(bookings.id, bookingIdNum));

    console.log(
      `Stripe webhook: Booking ${bookingIdNum} cancelled due to expired checkout session`
    );
  } else {
    console.log(
      `Stripe webhook: Booking ${bookingIdNum} has status '${booking.status}', not cancelling`
    );
  }
}

/**
 * Handles the payment_intent.payment_failed event.
 *
 * Called when a payment attempt fails (e.g., card declined, insufficient funds,
 * expired card, etc.). This handler logs the failure for debugging and updates
 * any pending transaction records to 'failed' status.
 *
 * ## Important Notes
 * - Does NOT automatically cancel the booking
 * - The user can retry the payment with a different card
 * - The checkout.session.expired handler will cancel if they abandon entirely
 *
 * ## Error Information
 * Logs the error message and code from Stripe for debugging purposes.
 * Common error codes: 'card_declined', 'expired_card', 'insufficient_funds'
 *
 * @param paymentIntent - The failed Stripe PaymentIntent object
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`Stripe webhook: payment_intent.payment_failed for ${paymentIntent.id}`);

  // Get booking ID from metadata
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId) {
    console.log('Stripe webhook: No bookingId in payment intent metadata');
    return;
  }

  const bookingIdNum = parseInt(bookingId, 10);

  // Log the failure for debugging
  const lastError = paymentIntent.last_payment_error;
  const errorMessage = lastError?.message || 'Unknown error';
  const errorCode = lastError?.code || 'unknown';

  console.error(
    `Stripe webhook: Payment failed for booking ${bookingIdNum}. ` +
      `Error: ${errorMessage} (code: ${errorCode})`
  );

  // Check if a failed transaction record exists
  const existingTransaction = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.stripePaymentIntentId, paymentIntent.id),
        eq(transactions.status, 'pending')
      )
    )
    .limit(1);

  if (existingTransaction.length > 0) {
    // Update existing pending transaction to failed
    await db
      .update(transactions)
      .set({ status: 'failed' })
      .where(eq(transactions.id, existingTransaction[0].id));

    console.log(`Stripe webhook: Transaction ${existingTransaction[0].id} marked as failed`);
  }

  // Note: We don't automatically cancel the booking on payment failure
  // The user can retry the payment. The checkout.session.expired webhook
  // handles the case where the user abandons the payment entirely.
}

/**
 * Handles the account.application.deauthorized event.
 *
 * When a coach disconnects their Stripe Connect account from the Co-duck platform,
 * this handler:
 * 1. Finds the coach profile with that Stripe account ID
 * 2. Clears the stripeAccountId
 * 3. Unpublishes the coach profile (can't accept payments)
 * 4. Cancels all future pending/confirmed bookings
 * 5. Notifies the coach
 *
 * @param stripeAccountId - The Stripe Connect account ID that was deauthorized
 */
async function handleConnectDeauthorized(stripeAccountId: string) {
  console.log(`Stripe webhook: account.application.deauthorized for ${stripeAccountId}`);

  if (!stripeAccountId) {
    console.error('Stripe webhook: No account ID in deauthorization event');
    return;
  }

  // Find the coach with this Stripe account
  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.stripeAccountId, stripeAccountId),
  });

  if (!profile) {
    console.log(`Stripe webhook: No coach profile found for Stripe account ${stripeAccountId}`);
    return;
  }

  // Clear Stripe account and unpublish profile
  await db
    .update(coachProfiles)
    .set({
      stripeAccountId: null,
      isPublished: false,
    })
    .where(eq(coachProfiles.userId, profile.userId));

  console.log(
    `Stripe webhook: Coach ${profile.userId} Stripe account cleared, profile unpublished`
  );

  // Cancel future bookings (can't process payments anymore)
  const now = new Date();
  const futureBookings = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.coachId, profile.userId), gte(bookings.startTime, now)));

  const pendingOrConfirmed = futureBookings.filter(
    (b) => b.status === 'pending' || b.status === 'confirmed'
  );

  for (const booking of pendingOrConfirmed) {
    await db
      .update(bookings)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        cancellationReason: 'Coach payment account disconnected',
      })
      .where(eq(bookings.id, booking.id));

    // Notify the client
    createNotification({
      userId: booking.clientId,
      type: 'booking_cancelled',
      title: 'Session cancelled',
      body: 'Your session was cancelled because the coach updated their payment settings.',
      link: `/dashboard/my-sessions/${booking.id}`,
    });
  }

  // Notify the coach
  createNotification({
    userId: profile.userId,
    type: 'system',
    title: 'Stripe account disconnected',
    body: 'Your Stripe Connect account has been disconnected. Your profile has been unpublished and future bookings cancelled. Reconnect Stripe to resume.',
    link: '/dashboard/payments',
  });

  console.log(
    `Stripe webhook: Cancelled ${pendingOrConfirmed.length} future bookings for coach ${profile.userId}`
  );
}

// ============================================================================
// MEMBERSHIPS: SUBSCRIPTION + INVOICE EVENTS
// ============================================================================

/**
 * Maps a Stripe subscription status to our narrower enum.
 *
 * Stripe emits more statuses than we model (e.g. `trialing`, `unpaid`,
 * `paused`). We collapse them sensibly so downstream code only has to
 * understand four values.
 */
function mapSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status
): 'active' | 'past_due' | 'canceled' | 'incomplete' {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
    default:
      return 'incomplete';
  }
}

/**
 * Reads our internal membership metadata off a Stripe subscription.
 *
 * We stamp `membershipId` / `clientId` / `coachId` onto the subscription at
 * Checkout creation time. If those are missing, this isn't one of our
 * membership subscriptions and the handler should no-op.
 */
function getMembershipMetadata(
  sub: Stripe.Subscription
): { membershipId: number; clientId: string; coachId: string } | null {
  const meta = sub.metadata ?? {};
  if (meta.productKind !== 'membership') return null;

  const membershipIdStr = meta.membershipId;
  const clientId = meta.clientId;
  const coachId = meta.coachId;

  if (!membershipIdStr || !clientId || !coachId) return null;
  const membershipId = Number.parseInt(membershipIdStr, 10);
  if (!Number.isFinite(membershipId) || membershipId <= 0) return null;

  return { membershipId, clientId, coachId };
}

/**
 * Handles `customer.subscription.created` and `customer.subscription.updated`.
 *
 * This is where we mirror Stripe's subscription state into our
 * `membership_subscriptions` table. It runs both at the end of the
 * subscription-mode Checkout (replacing `checkout.session.completed`) and
 * on every subsequent status transition (cancel-at-period-end toggled,
 * plan swap, etc.).
 *
 * ## Idempotency
 * Keyed on `stripeSubscriptionId` (unique column) — we either INSERT the
 * row the first time we see the sub, or UPDATE the existing row otherwise.
 *
 * ## Session allotment
 * On row creation, `sessionsRemainingThisPeriod` is seeded from the
 * membership's `sessionsPerPeriod`. On update we do NOT touch the
 * counter — `invoice.payment_succeeded` is responsible for resetting it
 * at each renewal.
 */
async function handleMembershipSubscriptionUpsert(sub: Stripe.Subscription) {
  console.log(`Stripe webhook: customer.subscription.upsert ${sub.id} (status=${sub.status})`);

  const meta = getMembershipMetadata(sub);
  if (!meta) {
    console.log(`Stripe webhook: subscription ${sub.id} has no membership metadata, skipping`);
    return;
  }

  const { membershipId, clientId, coachId } = meta;

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.id, membershipId),
  });

  if (!membership) {
    console.error(`Stripe webhook: membership ${membershipId} not found for sub ${sub.id}`);
    return;
  }

  const status = mapSubscriptionStatus(sub.status);
  const customerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer?.id ?? '');

  // Stripe's `Subscription` type under newer API versions has
  // current_period_start/end on the items, not the sub itself. Read
  // defensively from both to stay resilient across versions.
  const subWithPeriods = sub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const firstItem = sub.items?.data?.[0] as
    | (Stripe.SubscriptionItem & {
        current_period_start?: number;
        current_period_end?: number;
      })
    | undefined;

  const periodStartUnix =
    subWithPeriods.current_period_start ?? firstItem?.current_period_start ?? 0;
  const periodEndUnix = subWithPeriods.current_period_end ?? firstItem?.current_period_end ?? 0;

  const currentPeriodStart = new Date(periodStartUnix * 1000);
  const currentPeriodEnd = new Date(periodEndUnix * 1000);

  const canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000) : null;

  const existing = await db.query.membershipSubscriptions.findFirst({
    where: eq(membershipSubscriptions.stripeSubscriptionId, sub.id),
  });

  if (!existing) {
    await db.insert(membershipSubscriptions).values({
      membershipId,
      clientId,
      coachId,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      // Initial allotment — invoice.payment_succeeded will keep it in sync
      // on renewal. Initialised to full allotment on create.
      sessionsRemainingThisPeriod: membership.sessionsPerPeriod,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt,
    });

    console.log(
      `Stripe webhook: created membership_subscription for sub ${sub.id} ` +
        `(client=${clientId}, coach=${coachId}, membership=${membershipId})`
    );

    // Notify both parties that the subscription is live.
    if (status === 'active') {
      createNotification({
        userId: clientId,
        type: 'system',
        title: 'Membership active',
        body: `Your "${membership.name}" membership is now active. ${membership.sessionsPerPeriod} session${membership.sessionsPerPeriod === 1 ? '' : 's'} available this period.`,
        link: '/dashboard/my-memberships',
      });

      createNotification({
        userId: coachId,
        type: 'system',
        title: 'New membership subscriber',
        body: `A client just subscribed to "${membership.name}".`,
        link: '/dashboard/memberships',
      });
    }
  } else {
    await db
      .update(membershipSubscriptions)
      .set({
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt,
        updatedAt: new Date(),
      })
      .where(eq(membershipSubscriptions.id, existing.id));

    console.log(
      `Stripe webhook: updated membership_subscription ${existing.id} ` +
        `(status=${status}, cancelAtPeriodEnd=${sub.cancel_at_period_end})`
    );
  }
}

/**
 * Handles `customer.subscription.deleted` — the subscription has ended
 * (either `immediate=true` on cancel, or the end-of-period rollover after
 * `cancel_at_period_end`).
 *
 * We mark our row `canceled` and stamp `canceledAt`. Access logic (see
 * `/api/memberships/subscriptions/[id]/redeem`) keys off `status` so this
 * is the single source of truth.
 */
async function handleMembershipSubscriptionDeleted(sub: Stripe.Subscription) {
  console.log(`Stripe webhook: customer.subscription.deleted ${sub.id}`);

  const existing = await db.query.membershipSubscriptions.findFirst({
    where: eq(membershipSubscriptions.stripeSubscriptionId, sub.id),
  });

  if (!existing) {
    console.log(`Stripe webhook: no membership_subscription for sub ${sub.id}`);
    return;
  }

  if (existing.status === 'canceled') {
    console.log(`Stripe webhook: membership_subscription ${existing.id} already canceled`);
    return;
  }

  await db
    .update(membershipSubscriptions)
    .set({
      status: 'canceled',
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : new Date(),
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(membershipSubscriptions.id, existing.id));

  console.log(`Stripe webhook: membership_subscription ${existing.id} marked canceled`);

  createNotification({
    userId: existing.clientId,
    type: 'system',
    title: 'Membership ended',
    body: 'Your coaching membership has ended. You can resubscribe any time from the coach’s profile.',
    link: '/dashboard/my-memberships',
  });

  createNotification({
    userId: existing.coachId,
    type: 'system',
    title: 'Membership canceled',
    body: 'A client’s membership has ended.',
    link: '/dashboard/memberships',
  });
}

/**
 * Handles `invoice.payment_succeeded` — a successful charge on a
 * subscription. On period renewals this is where we **reset** the
 * client's session allotment for the new billing period.
 *
 * ## Billing reasons we care about
 * - `subscription_create` — first invoice at signup. Counter was seeded
 *   to the full allotment during subscription upsert; we make sure the
 *   period window is accurate.
 * - `subscription_cycle` — a regular monthly renewal. Reset the counter
 *   to the membership's `sessionsPerPeriod` and advance the window.
 * - `subscription_update` — mid-cycle plan change. Update the window
 *   without touching the counter (client has already consumed sessions
 *   this period).
 *
 * Everything else (e.g. one-off invoices) is ignored.
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log(
    `Stripe webhook: invoice.payment_succeeded ${invoice.id} (reason=${invoice.billing_reason})`
  );

  const invoiceWithSub = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const subscriptionId =
    typeof invoiceWithSub.subscription === 'string'
      ? invoiceWithSub.subscription
      : invoiceWithSub.subscription?.id;

  if (!subscriptionId) {
    // Not a subscription invoice — nothing to do for memberships.
    return;
  }

  const existing = await db.query.membershipSubscriptions.findFirst({
    where: eq(membershipSubscriptions.stripeSubscriptionId, subscriptionId),
  });

  if (!existing) {
    console.log(`Stripe webhook: no membership_subscription for subscription ${subscriptionId}`);
    return;
  }

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.id, existing.membershipId),
  });
  if (!membership) {
    console.error(
      `Stripe webhook: missing membership ${existing.membershipId} for sub ${subscriptionId}`
    );
    return;
  }

  // Determine whether to reset the session counter.
  const reason = invoice.billing_reason;
  const shouldResetCounter = reason === 'subscription_cycle' || reason === 'subscription_create';

  // Pull period bounds from the associated line (each line carries its own
  // period). Fall back to the invoice period if needed.
  const firstLine = invoice.lines?.data?.[0];
  const periodStartUnix =
    firstLine?.period?.start ??
    (invoice as Stripe.Invoice & { period_start?: number }).period_start ??
    0;
  const periodEndUnix =
    firstLine?.period?.end ?? (invoice as Stripe.Invoice & { period_end?: number }).period_end ?? 0;

  const updatePayload: Partial<typeof membershipSubscriptions.$inferInsert> = {
    status: 'active',
    updatedAt: new Date(),
  };

  if (periodStartUnix && periodEndUnix) {
    updatePayload.currentPeriodStart = new Date(periodStartUnix * 1000);
    updatePayload.currentPeriodEnd = new Date(periodEndUnix * 1000);
  }

  if (shouldResetCounter) {
    updatePayload.sessionsRemainingThisPeriod = membership.sessionsPerPeriod;
  }

  await db
    .update(membershipSubscriptions)
    .set(updatePayload)
    .where(eq(membershipSubscriptions.id, existing.id));

  console.log(
    `Stripe webhook: membership_subscription ${existing.id} invoice applied ` +
      `(reason=${reason}, resetCounter=${shouldResetCounter})`
  );

  if (reason === 'subscription_cycle') {
    createNotification({
      userId: existing.clientId,
      type: 'system',
      title: 'Membership renewed',
      body: `Your "${membership.name}" membership renewed. ${membership.sessionsPerPeriod} session${membership.sessionsPerPeriod === 1 ? '' : 's'} available this period.`,
      link: '/dashboard/my-memberships',
    });
  }
}

/**
 * Handles `invoice.payment_failed` — a subscription invoice couldn't be
 * collected.
 *
 * We don't cancel immediately: Stripe Smart Retries will re-attempt
 * collection. We flip the row to `past_due` so the UI can surface a
 * "Please update your card" nudge, and `redeem` still allows bookings
 * during the grace window (see route logic).
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`Stripe webhook: invoice.payment_failed ${invoice.id}`);

  const invoiceWithSub = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const subscriptionId =
    typeof invoiceWithSub.subscription === 'string'
      ? invoiceWithSub.subscription
      : invoiceWithSub.subscription?.id;

  if (!subscriptionId) return;

  const existing = await db.query.membershipSubscriptions.findFirst({
    where: eq(membershipSubscriptions.stripeSubscriptionId, subscriptionId),
  });
  if (!existing) return;

  await db
    .update(membershipSubscriptions)
    .set({ status: 'past_due', updatedAt: new Date() })
    .where(eq(membershipSubscriptions.id, existing.id));

  console.log(`Stripe webhook: membership_subscription ${existing.id} marked past_due`);

  createNotification({
    userId: existing.clientId,
    type: 'system',
    title: 'Membership payment failed',
    body: 'We couldn’t collect your membership payment. Please update your payment method to keep access.',
    link: '/dashboard/my-memberships',
  });
}

// ============================================================================
// PACKAGE PURCHASE HANDLER (P0-05)
// ============================================================================

async function handlePackageCheckoutCompleted(session: Stripe.Checkout.Session) {
  const {
    packageId: packageIdStr,
    coachId,
    clientId,
    feeRate: feeRateStr,
  } = session.metadata ?? {};

  if (!packageIdStr || !coachId || !clientId) {
    console.error('Stripe webhook [package]: Missing metadata fields', session.metadata);
    return;
  }

  const packageId = parseInt(packageIdStr);
  if (isNaN(packageId)) {
    console.error('Stripe webhook [package]: Invalid packageId', packageIdStr);
    return;
  }

  if (session.payment_status !== 'paid') {
    console.log(`Stripe webhook [package]: payment_status=${session.payment_status}, skipping`);
    return;
  }

  // Idempotency: skip if purchase already recorded for this checkout session
  const existing = await db
    .select({ id: packagePurchases.id })
    .from(packagePurchases)
    .where(eq(packagePurchases.stripeCheckoutSessionId, session.id))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Stripe webhook [package]: purchase already recorded for session ${session.id}`);
    return;
  }

  const [pkg] = await db
    .select({ sessionCount: packages.sessionCount, validityDays: packages.validityDays })
    .from(packages)
    .where(eq(packages.id, packageId))
    .limit(1);

  if (!pkg) {
    console.error(`Stripe webhook [package]: Package ${packageId} not found`);
    return;
  }

  const amountTotal = session.amount_total ?? 0;
  const feeRate = parseFloat(feeRateStr ?? '0.1');
  const platformFeeCents = Math.round(amountTotal * feeRate);
  const coachPayoutCents = amountTotal - platformFeeCents;

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const purchasedAt = new Date();
  const expiresAt = new Date(purchasedAt.getTime() + pkg.validityDays * 24 * 60 * 60 * 1000);

  await db.insert(packagePurchases).values({
    packageId,
    clientId,
    coachId,
    purchasedAt,
    expiresAt,
    totalSessions: pkg.sessionCount,
    usedSessions: 0,
    totalPaidCents: amountTotal,
    platformFeeCents,
    coachPayoutCents,
    status: 'active',
    stripePaymentIntentId: paymentIntentId,
    stripeCheckoutSessionId: session.id,
  });

  console.log(
    `Stripe webhook [package]: Purchase recorded for package ${packageId}, client ${clientId}`
  );
}

// ============================================================================
// SUBSCRIPTION HANDLERS (P0-07)
// ============================================================================

/**
 * Stripe's Subscription object exposes `current_period_start`, `current_period_end`
 * and `trial_end` as Unix timestamps on the raw payload, but the SDK typings
 * sometimes omit them at the top level (they are declared on subscription items
 * in newer API versions). We narrow the type locally instead of reaching for `any`.
 */
type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_start: number;
  current_period_end: number;
  trial_end: number | null;
};

type DbSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';

/**
 * Maps a Stripe subscription status onto the subset of statuses tracked in our DB.
 * Stripe statuses we don't model (`unpaid`, `incomplete_expired`, `paused`) collapse
 * to their nearest equivalent so the column remains a strict enum.
 */
function mapStripeStatusToDb(status: Stripe.Subscription.Status): DbSubscriptionStatus {
  switch (status) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'canceled':
    case 'incomplete':
      return status;
    case 'unpaid':
      return 'past_due';
    case 'incomplete_expired':
      return 'canceled';
    case 'paused':
      return 'active';
    default: {
      const _exhaustive: never = status;
      void _exhaustive;
      return 'incomplete';
    }
  }
}

async function handleSubscriptionUpserted(sub: Stripe.Subscription) {
  // Skip membership subscriptions — those are handled by the
  // handleMembershipSubscription* handlers, not coachSubscriptions (P0-07).
  if (sub.metadata?.productKind === 'membership') return;

  const coachId = sub.metadata?.coachId;
  const planId = sub.metadata?.planId ?? 'starter';
  const billingInterval = (sub.metadata?.billingInterval ?? 'monthly') as 'monthly' | 'yearly';

  if (!coachId) {
    console.error('Stripe webhook [subscription]: Missing coachId in metadata');
    return;
  }

  const stripeCustomerId =
    typeof sub.customer === 'string' ? sub.customer : (sub.customer?.id ?? null);

  const typedSub = sub as SubscriptionWithPeriod;
  const currentPeriodStart = new Date(typedSub.current_period_start * 1000);
  const currentPeriodEnd = new Date(typedSub.current_period_end * 1000);
  const trialEndsAt = typedSub.trial_end ? new Date(typedSub.trial_end * 1000) : null;
  const status = mapStripeStatusToDb(sub.status);

  await db
    .insert(coachSubscriptions)
    .values({
      coachId,
      planId,
      billingInterval,
      stripeSubscriptionId: sub.id,
      stripeCustomerId,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      trialEndsAt: trialEndsAt ?? undefined,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: coachSubscriptions.coachId,
      set: {
        planId,
        billingInterval,
        stripeSubscriptionId: sub.id,
        stripeCustomerId,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        trialEndsAt: trialEndsAt ?? undefined,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    });

  console.log(
    `Stripe webhook [subscription]: Upserted plan=${planId} status=${sub.status} for coach ${coachId}`
  );
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  // Skip membership subscriptions — those are handled by the
  // handleMembershipSubscription* handlers, not coachSubscriptions (P0-07).
  if (sub.metadata?.productKind === 'membership') return;

  const coachId = sub.metadata?.coachId;
  if (!coachId) {
    console.error('Stripe webhook [subscription]: Missing coachId in deleted subscription');
    return;
  }

  await db
    .update(coachSubscriptions)
    .set({ status: 'canceled', cancelAtPeriodEnd: false })
    .where(eq(coachSubscriptions.coachId, coachId));

  console.log(`Stripe webhook [subscription]: Marked canceled for coach ${coachId}`);
}
