import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for Stripe configuration and utility functions.
 *
 * The stripe module validates env vars at import time, so we use dynamic
 * imports with vi.resetModules() to test different env configurations.
 */

// Mock the Stripe constructor since we don't want real API connections
vi.mock('stripe', () => {
  class MockStripe {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(key: string, config?: Record<string, unknown>) {
      // no-op
    }
    checkout = { sessions: { create: vi.fn() } };
    paymentIntents = { create: vi.fn() };
    refunds = { create: vi.fn() };
  }
  return { default: MockStripe };
});

describe('stripe module — environment validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws if STRIPE_SECRET_KEY is missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    await expect(() => import('./stripe')).rejects.toThrow('STRIPE_SECRET_KEY is not set');
  });

  it('initializes successfully when STRIPE_SECRET_KEY is set', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_12345';

    const mod = await import('./stripe');
    expect(mod.stripe).toBeDefined();
  });
});

describe('getStripePublishableKey', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Must set the secret key so the module loads
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_12345';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns the publishable key when set', async () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake_key_12345';

    const { getStripePublishableKey } = await import('./stripe');
    expect(getStripePublishableKey()).toBe('pk_test_fake_key_12345');
  });

  it('throws if NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing', async () => {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    const { getStripePublishableKey } = await import('./stripe');
    expect(() => getStripePublishableKey()).toThrow('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
  });

  it('throws if NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is empty string', async () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = '';

    const { getStripePublishableKey } = await import('./stripe');
    expect(() => getStripePublishableKey()).toThrow('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
  });
});
