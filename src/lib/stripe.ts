import Stripe from 'stripe';

// Validate required environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    'STRIPE_SECRET_KEY is not set. Please add it to your .env.local file. ' +
      'You can find your secret key in the Stripe Dashboard: https://dashboard.stripe.com/apikeys'
  );
}

// Server-side Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

// Validate publishable key for client-side usage
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

// Export for type safety
export type { Stripe };
