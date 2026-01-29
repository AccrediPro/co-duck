import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { db, bookings, transactions } from '@/db';
import { eq, and } from 'drizzle-orm';
import type Stripe from 'stripe';
import { createBookingSystemMessage } from '@/lib/conversations';
import type { BookingSessionType } from '@/db/schema';

// Helper to get STRIPE_WEBHOOK_SECRET
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

// POST /api/webhooks/stripe - Handle Stripe webhook events
export async function POST(req: Request) {
  let event: Stripe.Event;

  try {
    // Get the raw body as text for signature verification
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('Stripe webhook: Missing stripe-signature header');
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    // Verify the webhook signature
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

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'checkout.session.expired': {
        await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'payment_intent.payment_failed': {
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      }

      default:
        // Log unhandled event types for monitoring
        console.log(`Stripe webhook: Unhandled event type: ${event.type}`);
    }

    return new Response('Webhook processed', { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error(`Stripe webhook error handling ${event.type}:`, error.message);
    // Return 200 to prevent Stripe from retrying (we've logged the error for debugging)
    // For critical errors, you might want to return 500 to trigger retries
    return new Response('Webhook handler error', { status: 200 });
  }
}

// Handle checkout.session.completed event
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
  await db.insert(transactions).values({
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
  });

  console.log(`Stripe webhook: Transaction created for booking ${bookingIdNum}`);

  // Create system message in conversation for the booking
  // Get session type from booking for the message
  const sessionType = booking.sessionType as BookingSessionType;
  createBookingSystemMessage(coachId, clientId, sessionType, booking.startTime).catch((error) => {
    console.error('Stripe webhook: Error creating booking system message:', error);
    // Don't fail the webhook if message creation fails
  });
}

// Handle checkout.session.expired event
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

// Handle payment_intent.payment_failed event (for error tracking)
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
