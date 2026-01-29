/**
 * Refund calculation utilities for cancellation flow
 */

export interface RefundEligibility {
  isEligible: boolean;
  refundAmountCents: number;
  refundPercentage: number;
  reason: string;
  hoursUntilSession: number;
}

/**
 * Calculate refund eligibility based on cancellation timing
 *
 * Current policy:
 * - Full refund if cancelled > 24 hours before session
 * - No refund if cancelled within 24 hours
 *
 * Future enhancement: Make the 24-hour threshold configurable per coach
 */
export function calculateRefundEligibility(
  sessionStartTime: Date,
  paidAmountCents: number,
  cancellationThresholdHours: number = 24
): RefundEligibility {
  const now = new Date();
  const msUntilSession = sessionStartTime.getTime() - now.getTime();
  const hoursUntilSession = msUntilSession / (1000 * 60 * 60);

  // Session is in the past - no refund
  if (hoursUntilSession < 0) {
    return {
      isEligible: false,
      refundAmountCents: 0,
      refundPercentage: 0,
      reason: 'Session has already occurred',
      hoursUntilSession,
    };
  }

  // Cancelled with sufficient notice - full refund
  if (hoursUntilSession >= cancellationThresholdHours) {
    return {
      isEligible: true,
      refundAmountCents: paidAmountCents,
      refundPercentage: 100,
      reason: `Cancelled with more than ${cancellationThresholdHours} hours notice`,
      hoursUntilSession,
    };
  }

  // Cancelled within threshold - no refund
  return {
    isEligible: false,
    refundAmountCents: 0,
    refundPercentage: 0,
    reason: `Cancelled within ${cancellationThresholdHours} hours of session`,
    hoursUntilSession,
  };
}

/**
 * Format refund amount for display
 */
export function formatRefundAmount(amountCents: number, currency: string = 'USD'): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

/**
 * Get user-friendly refund message for cancellation dialog
 */
export function getRefundMessage(
  eligibility: RefundEligibility,
  currency: string = 'USD'
): { title: string; description: string } {
  if (eligibility.refundAmountCents === 0 && eligibility.hoursUntilSession >= 0) {
    // No payment was made (free session or unpaid)
    return {
      title: 'No refund applicable',
      description: 'This session is free or has not been paid for.',
    };
  }

  if (eligibility.isEligible) {
    const formattedAmount = formatRefundAmount(eligibility.refundAmountCents, currency);
    return {
      title: 'Full refund available',
      description: `You will receive a full refund of ${formattedAmount}.`,
    };
  }

  return {
    title: 'No refund available',
    description: 'Cancelled within 24 hours of the scheduled session time.',
  };
}
