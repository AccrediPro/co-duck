/**
 * @fileoverview Stripe client configuration and initialization.
 *
 * This module provides a pre-configured Stripe client for server-side operations
 * and utilities for accessing Stripe configuration values.
 *
 * @module lib/stripe
 *
 * ## Overview
 *
 * The coaching platform uses Stripe Connect to facilitate payments between clients
 * and coaches. Key features:
 *
 * - **Stripe Connect**: Coaches are connected accounts receiving direct payouts
 * - **Destination Charges**: Payments go to platform, then transferred to coaches
 * - **Platform Fee**: 10% retained by platform on each transaction
 *
 * ## Required Environment Variables
 *
 * | Variable | Location | Purpose |
 * |----------|----------|---------|
 * | `STRIPE_SECRET_KEY` | `.env.local` | Server-side API calls |
 * | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `.env.local` | Client-side Stripe.js |
 * | `STRIPE_WEBHOOK_SECRET` | `.env.local` | Webhook signature verification |
 *
 * ## Configuration Notes
 *
 * - Get keys from: https://dashboard.stripe.com/apikeys
 * - Test mode keys start with `sk_test_` and `pk_test_`
 * - Live mode keys start with `sk_live_` and `pk_live_`
 * - Webhook secrets start with `whsec_`
 *
 * ## Usage
 *
 * ```typescript
 * import { stripe } from '@/lib/stripe';
 *
 * // Create a checkout session
 * const session = await stripe.checkout.sessions.create({
 *   mode: 'payment',
 *   line_items: [...],
 *   success_url: 'https://...',
 *   cancel_url: 'https://...',
 * });
 * ```
 *
 * ## Error Handling
 *
 * Stripe operations can fail for various reasons. Always wrap Stripe calls
 * in try-catch blocks and handle errors appropriately:
 *
 * ```typescript
 * import { stripe, type Stripe } from '@/lib/stripe';
 *
 * try {
 *   const session = await stripe.checkout.sessions.create({...});
 * } catch (error) {
 *   if (error instanceof Stripe.errors.StripeError) {
 *     // Handle specific Stripe errors
 *     switch (error.type) {
 *       case 'StripeCardError':
 *         // Card was declined
 *         console.error('Card error:', error.message);
 *         break;
 *       case 'StripeRateLimitError':
 *         // Too many requests
 *         console.error('Rate limit hit, retry later');
 *         break;
 *       case 'StripeInvalidRequestError':
 *         // Invalid parameters
 *         console.error('Invalid request:', error.message);
 *         break;
 *       case 'StripeAPIError':
 *         // Stripe server error
 *         console.error('Stripe API error:', error.message);
 *         break;
 *       case 'StripeConnectionError':
 *         // Network error
 *         console.error('Network error:', error.message);
 *         break;
 *       case 'StripeAuthenticationError':
 *         // Invalid API key
 *         console.error('Authentication failed');
 *         break;
 *     }
 *   }
 *   throw error;
 * }
 * ```
 *
 * ## Common Error Codes
 *
 * | Code | Meaning | Action |
 * |------|---------|--------|
 * | `card_declined` | Card was declined | Ask for different card |
 * | `expired_card` | Card has expired | Ask for different card |
 * | `insufficient_funds` | Not enough balance | Ask for different card |
 * | `processing_error` | Temporary failure | Retry once |
 * | `rate_limit` | Too many requests | Exponential backoff |
 *
 * @see {@link https://stripe.com/docs/api | Stripe API Reference}
 * @see {@link https://stripe.com/docs/connect | Stripe Connect Documentation}
 * @see {@link https://stripe.com/docs/error-handling | Stripe Error Handling Guide}
 * @see {@link src/app/api/webhooks/stripe/route.ts | Stripe Webhook Handler}
 */

import Stripe from 'stripe';

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

/**
 * Validates that the STRIPE_SECRET_KEY environment variable is set.
 *
 * This validation runs at module load time (server startup) to fail fast
 * if the required configuration is missing.
 *
 * @throws {Error} If STRIPE_SECRET_KEY is not set in environment variables
 *
 * @remarks
 * - This is a server-side only check
 * - The error message includes a link to the Stripe Dashboard
 * - In development, add the key to `.env.local`
 * - In production, configure via your hosting platform's secrets management
 */
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    'STRIPE_SECRET_KEY is not set. Please add it to your .env.local file. ' +
      'You can find your secret key in the Stripe Dashboard: https://dashboard.stripe.com/apikeys'
  );
}

// ============================================================================
// STRIPE CLIENT INSTANCE
// ============================================================================

/**
 * Pre-configured Stripe client for server-side API calls.
 *
 * This is the primary entry point for all Stripe operations in the application.
 * It's configured with:
 * - The secret key from environment variables
 * - A pinned API version for stability
 * - TypeScript types enabled
 *
 * @example
 * ```typescript
 * import { stripe } from '@/lib/stripe';
 *
 * // Create a payment intent
 * const paymentIntent = await stripe.paymentIntents.create({
 *   amount: 5000, // $50.00 in cents
 *   currency: 'usd',
 * });
 *
 * // Retrieve a customer
 * const customer = await stripe.customers.retrieve('cus_xxx');
 *
 * // Create a Stripe Connect checkout session with platform fee
 * const session = await stripe.checkout.sessions.create({
 *   mode: 'payment',
 *   line_items: [{
 *     price_data: {
 *       currency: 'usd',
 *       unit_amount: 10000, // $100.00
 *       product_data: { name: 'Coaching Session' },
 *     },
 *     quantity: 1,
 *   }],
 *   payment_intent_data: {
 *     application_fee_amount: 1000, // 10% platform fee
 *     transfer_data: {
 *       destination: 'acct_xxx', // Coach's Stripe Connect account
 *     },
 *   },
 *   success_url: 'https://example.com/success',
 *   cancel_url: 'https://example.com/cancel',
 * });
 * ```
 *
 * @remarks
 * - **API Version**: Pinned to '2026-01-28.clover' for stability
 * - **Thread Safety**: The client is stateless and safe for concurrent use
 * - **Error Handling**: All methods may throw `Stripe.errors.StripeError`
 *
 * @see {@link https://stripe.com/docs/api/versioning | Stripe API Versioning}
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

// ============================================================================
// CONFIGURATION UTILITIES
// ============================================================================

/**
 * Retrieves the Stripe publishable key for client-side usage.
 *
 * The publishable key is safe to expose in client-side code and is required
 * for initializing Stripe.js and Stripe Elements in the browser.
 *
 * @returns The Stripe publishable key from environment variables
 *
 * @throws {Error} If NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set
 *
 * @example
 * ```typescript
 * // In a client component
 * import { getStripePublishableKey } from '@/lib/stripe';
 * import { loadStripe } from '@stripe/stripe-js';
 *
 * const stripePromise = loadStripe(getStripePublishableKey());
 *
 * // Use with Elements provider
 * <Elements stripe={stripePromise}>
 *   <CheckoutForm />
 * </Elements>
 * ```
 *
 * @remarks
 * - Publishable keys are prefixed with `pk_test_` or `pk_live_`
 * - These keys can only be used for read operations and tokenization
 * - They cannot be used to charge cards or access sensitive data
 * - The `NEXT_PUBLIC_` prefix makes this variable available to the browser
 *
 * @see {@link https://stripe.com/docs/keys | Stripe API Keys}
 * @see {@link https://stripe.com/docs/stripe-js | Stripe.js Documentation}
 */
export function getStripePublishableKey(): string {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Please add it to your .env.local file. ' +
        'You can find your publishable key in the Stripe Dashboard: https://dashboard.stripe.com/apikeys'
    );
  }

  return publishableKey;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Re-exported Stripe types for use throughout the application.
 *
 * Importing the Stripe type from this module ensures type consistency
 * and avoids version mismatches.
 *
 * @example
 * ```typescript
 * import { stripe, type Stripe } from '@/lib/stripe';
 *
 * // Type a checkout session
 * const session: Stripe.Checkout.Session = await stripe.checkout.sessions.create({...});
 *
 * // Type a payment intent
 * const intent: Stripe.PaymentIntent = await stripe.paymentIntents.retrieve('pi_xxx');
 *
 * // Type an error handler
 * function handleStripeError(error: Stripe.errors.StripeError) {
 *   console.error('Stripe error:', error.code, error.message);
 * }
 * ```
 *
 * @remarks
 * Common Stripe types used in this application:
 * - `Stripe.Checkout.Session` - Checkout session objects
 * - `Stripe.PaymentIntent` - Payment intent objects
 * - `Stripe.Refund` - Refund objects
 * - `Stripe.Event` - Webhook event objects
 * - `Stripe.errors.StripeError` - Base error class for Stripe errors
 */
export type { Stripe };
