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
import { eq, and, gte } from 'drizzle-orm';
import type Stripe from 'stripe';
import { createBookingSystemMessage } from '@/lib/conversations';
import type { BookingSessionType } from '@/db/schema';
import { syncBookingToCalendar } from '@/lib/google-calendar-sync';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';
import { PaymentReceiptEmail } from '@/lib/emails';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';

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

  // Only update if booking is still pending
  if (booking.status === 'pending') {
    await db.update(bookings).set({ status: 'confirmed' }).where(eq(bookings.id, bookingIdNum));
    console.log(`Stripe webhook: Booking ${bookingIdNum} updated to confirmed`);
  } else {
    console.log(`Stripe webhook: Booking ${bookingIdNum} already has status '${booking.status}'`);
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

  // Send payment receipt email to client (non-blocking)
  const sessionType = booking.sessionType as BookingSessionType;
  const [clientUser, coachUser] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, clientId) }),
    db.query.users.findFirst({ where: eq(users.id, coachId) }),
  ]);

  if (clientUser?.email && coachUser) {
    sendEmail({
      to: clientUser.email,
      subject: `Payment receipt for ${sessionType?.name || 'Coaching session'} with ${coachUser.name || 'your coach'}`,
      react: PaymentReceiptEmail({
        clientName: clientUser.name || 'there',
        coachName: coachUser.name || 'Your Coach',
        sessionType: sessionType?.name || 'Coaching Session',
        sessionDate: booking.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        sessionTime: booking.startTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        duration: sessionType?.duration || 60,
        amountCents: amountTotal,
        currency,
        transactionId: newTransaction.id,
        bookingId: bookingIdNum,
        unsubscribeUrl: getUnsubscribeUrl(clientId, 'bookings'),
      }),
    }).catch((err) => console.error('Failed to send payment receipt email:', err));
  }

  // Create system message in conversation for the booking
  // Get session type from booking for the message
  createBookingSystemMessage(coachId, clientId, sessionType, booking.startTime).catch((error) => {
    console.error('Stripe webhook: Error creating booking system message:', error);
    // Don't fail the webhook if message creation fails
  });

  // Notify both parties about the confirmed booking
  const sessionName = sessionType?.name || 'Coaching session';
  createNotification({
    userId: coachId,
    type: 'booking_confirmed',
    title: 'New booking confirmed',
    body: `${sessionName} has been booked and paid.`,
    link: `/dashboard/sessions/${bookingIdNum}`,
  });
  createNotification({
    userId: clientId,
    type: 'booking_confirmed',
    title: 'Booking confirmed',
    body: `Your ${sessionName} has been confirmed.`,
    link: `/dashboard/my-sessions/${bookingIdNum}`,
  });

  // Sync booking to Google Calendar for connected users
  syncBookingToCalendar(bookingIdNum).catch((error) => {
    console.error('Stripe webhook: Error syncing booking to calendar:', error);
    // Don't fail the webhook if calendar sync fails
  });
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
 * When a coach disconnects their Stripe Connect account from the CoachHub platform,
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
