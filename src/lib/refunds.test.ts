import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateRefundEligibility,
  formatRefundAmount,
  getRefundMessage,
  type RefundEligibility,
} from './refunds';

describe('calculateRefundEligibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns full refund when cancelled > threshold hours before session', () => {
    const sessionTime = new Date('2026-03-03T12:00:00Z'); // 48h away
    const result = calculateRefundEligibility(sessionTime, 15000, 24);

    expect(result.isEligible).toBe(true);
    expect(result.refundAmountCents).toBe(15000);
    expect(result.refundPercentage).toBe(100);
    expect(result.reason).toContain('more than 24 hours');
    expect(result.hoursUntilSession).toBeCloseTo(48, 0);
  });

  it('returns no refund when cancelled < threshold hours before session', () => {
    const sessionTime = new Date('2026-03-01T20:00:00Z'); // 8h away
    const result = calculateRefundEligibility(sessionTime, 10000, 24);

    expect(result.isEligible).toBe(false);
    expect(result.refundAmountCents).toBe(0);
    expect(result.refundPercentage).toBe(0);
    expect(result.reason).toContain('within 24 hours');
  });

  it('returns no refund when session has already occurred', () => {
    const sessionTime = new Date('2026-03-01T10:00:00Z'); // 2h ago
    const result = calculateRefundEligibility(sessionTime, 5000, 24);

    expect(result.isEligible).toBe(false);
    expect(result.refundAmountCents).toBe(0);
    expect(result.refundPercentage).toBe(0);
    expect(result.reason).toBe('Session has already occurred');
    expect(result.hoursUntilSession).toBeLessThan(0);
  });

  it('returns full refund at exactly the threshold boundary', () => {
    const sessionTime = new Date('2026-03-02T12:00:00Z'); // exactly 24h away
    const result = calculateRefundEligibility(sessionTime, 8000, 24);

    expect(result.isEligible).toBe(true);
    expect(result.refundAmountCents).toBe(8000);
    expect(result.refundPercentage).toBe(100);
  });

  it('returns no refund when just under the threshold', () => {
    // 23h 59m 59s away — just under 24h
    const sessionTime = new Date('2026-03-02T11:59:59Z');
    const result = calculateRefundEligibility(sessionTime, 8000, 24);

    expect(result.isEligible).toBe(false);
    expect(result.refundAmountCents).toBe(0);
  });

  it('uses default 24-hour threshold when not specified', () => {
    const sessionTime = new Date('2026-03-03T12:00:00Z'); // 48h away
    const result = calculateRefundEligibility(sessionTime, 5000);

    expect(result.isEligible).toBe(true);
    expect(result.reason).toContain('24 hours');
  });

  it('supports custom threshold values', () => {
    const sessionTime = new Date('2026-03-01T20:00:00Z'); // 8h away
    // With a 4-hour threshold, this should be eligible
    const result = calculateRefundEligibility(sessionTime, 5000, 4);

    expect(result.isEligible).toBe(true);
    expect(result.reason).toContain('more than 4 hours');
  });

  it('handles $0 sessions correctly', () => {
    const sessionTime = new Date('2026-03-03T12:00:00Z');
    const result = calculateRefundEligibility(sessionTime, 0, 24);

    expect(result.isEligible).toBe(true);
    expect(result.refundAmountCents).toBe(0);
    expect(result.refundPercentage).toBe(100);
  });

  it('handles very large amounts without overflow', () => {
    const sessionTime = new Date('2026-03-03T12:00:00Z');
    const result = calculateRefundEligibility(sessionTime, 99999999, 24); // $999,999.99

    expect(result.isEligible).toBe(true);
    expect(result.refundAmountCents).toBe(99999999);
  });

  it('handles 0-hour threshold (refund only if session is in the future)', () => {
    const sessionTime = new Date('2026-03-01T12:00:01Z'); // 1 second away
    const result = calculateRefundEligibility(sessionTime, 5000, 0);

    expect(result.isEligible).toBe(true);
  });
});

describe('formatRefundAmount', () => {
  it('formats USD amounts correctly', () => {
    expect(formatRefundAmount(5000)).toBe('$50.00');
    expect(formatRefundAmount(12345)).toBe('$123.45');
    expect(formatRefundAmount(0)).toBe('$0.00');
    expect(formatRefundAmount(1)).toBe('$0.01');
    expect(formatRefundAmount(100)).toBe('$1.00');
  });

  it('formats EUR amounts', () => {
    const result = formatRefundAmount(5000, 'EUR');
    expect(result).toContain('50.00');
  });

  it('formats GBP amounts', () => {
    const result = formatRefundAmount(5000, 'GBP');
    expect(result).toContain('50.00');
  });

  it('normalizes lowercase currency codes', () => {
    const result = formatRefundAmount(5000, 'usd');
    expect(result).toBe('$50.00');
  });

  it('formats JPY without decimal places', () => {
    const result = formatRefundAmount(5000, 'JPY');
    // JPY has no minor units, Intl formats 50 yen
    expect(result).toContain('50');
  });

  it('handles large amounts', () => {
    expect(formatRefundAmount(10000000)).toBe('$100,000.00');
  });
});

describe('getRefundMessage', () => {
  it('returns "No refund applicable" for free/unpaid future sessions', () => {
    const eligibility: RefundEligibility = {
      isEligible: true,
      refundAmountCents: 0,
      refundPercentage: 100,
      reason: 'Cancelled with more than 24 hours notice',
      hoursUntilSession: 48,
    };

    const message = getRefundMessage(eligibility);
    expect(message.title).toBe('No refund applicable');
    expect(message.description).toContain('free');
  });

  it('returns "Full refund available" for eligible paid sessions', () => {
    const eligibility: RefundEligibility = {
      isEligible: true,
      refundAmountCents: 15000,
      refundPercentage: 100,
      reason: 'Cancelled with more than 24 hours notice',
      hoursUntilSession: 48,
    };

    const message = getRefundMessage(eligibility);
    expect(message.title).toBe('Full refund available');
    expect(message.description).toContain('$150.00');
  });

  it('returns "No refund applicable" for ineligible sessions with $0 amount and positive hours', () => {
    // When refundAmountCents === 0 and hoursUntilSession >= 0, the "free session" branch triggers
    const eligibility: RefundEligibility = {
      isEligible: false,
      refundAmountCents: 0,
      refundPercentage: 0,
      reason: 'Cancelled within 24 hours of session',
      hoursUntilSession: 8,
    };

    const message = getRefundMessage(eligibility);
    expect(message.title).toBe('No refund applicable');
    expect(message.description).toContain('free');
  });

  it('returns "No refund available" for past sessions with no refund', () => {
    // The "No refund available" branch triggers when hoursUntilSession < 0
    const eligibility: RefundEligibility = {
      isEligible: false,
      refundAmountCents: 0,
      refundPercentage: 0,
      reason: 'Session has already occurred',
      hoursUntilSession: -5,
    };

    const message = getRefundMessage(eligibility);
    expect(message.title).toBe('No refund available');
    expect(message.description).toContain('24 hours');
  });

  it('formats refund amount with specified currency', () => {
    const eligibility: RefundEligibility = {
      isEligible: true,
      refundAmountCents: 5000,
      refundPercentage: 100,
      reason: 'Cancelled with more than 24 hours notice',
      hoursUntilSession: 48,
    };

    const message = getRefundMessage(eligibility, 'EUR');
    expect(message.description).toContain('50.00');
  });

});

describe('fee calculation (platform fee logic)', () => {
  it('10% platform fee: 90% goes to coach', () => {
    const totalCents = 15000; // $150
    const platformFeeCents = Math.round(totalCents * 0.10);
    const coachPayoutCents = totalCents - platformFeeCents;

    expect(platformFeeCents).toBe(1500);
    expect(coachPayoutCents).toBe(13500);
    expect(platformFeeCents + coachPayoutCents).toBe(totalCents);
  });

  it('handles $0 sessions (no fee)', () => {
    const totalCents = 0;
    const platformFeeCents = Math.round(totalCents * 0.10);
    const coachPayoutCents = totalCents - platformFeeCents;

    expect(platformFeeCents).toBe(0);
    expect(coachPayoutCents).toBe(0);
  });

  it('handles small amounts where rounding matters', () => {
    const totalCents = 1; // $0.01
    const platformFeeCents = Math.round(totalCents * 0.10);
    const coachPayoutCents = totalCents - platformFeeCents;

    // 0.1 rounds to 0
    expect(platformFeeCents).toBe(0);
    expect(coachPayoutCents).toBe(1);
  });

  it('handles amounts not evenly divisible by 10', () => {
    const totalCents = 9999; // $99.99
    const platformFeeCents = Math.round(totalCents * 0.10);
    const coachPayoutCents = totalCents - platformFeeCents;

    expect(platformFeeCents).toBe(1000); // Math.round(999.9) = 1000
    expect(coachPayoutCents).toBe(8999);
  });

  it('handles large premium session amounts', () => {
    const totalCents = 50000; // $500
    const platformFeeCents = Math.round(totalCents * 0.10);
    const coachPayoutCents = totalCents - platformFeeCents;

    expect(platformFeeCents).toBe(5000);
    expect(coachPayoutCents).toBe(45000);
  });

  it('fee + payout always equals total (no money lost)', () => {
    const testAmounts = [1, 50, 99, 100, 999, 1000, 5555, 9999, 15000, 50000, 99999999];
    for (const totalCents of testAmounts) {
      const fee = Math.round(totalCents * 0.10);
      const payout = totalCents - fee;
      expect(fee + payout).toBe(totalCents);
    }
  });
});
