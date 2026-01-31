/**
 * @fileoverview Refund calculation utilities for session cancellation flow.
 *
 * This module provides utilities for calculating refund eligibility and amounts
 * when sessions are cancelled. It handles the business logic for determining
 * whether a refund should be issued based on cancellation timing.
 *
 * @module lib/refunds
 *
 * ## Refund Policy Overview
 *
 * The platform has different refund policies based on who cancels:
 *
 * ### Coach Cancellations
 * - **Always 100% refund** - Clients always receive a full refund
 * - Handled in `src/app/(dashboard)/dashboard/sessions/actions.ts`
 *
 * ### Client Cancellations
 * - **Time-based sliding scale** using `cancellationThresholdHours`
 * - Default threshold: 24 hours
 * - More than threshold hours before session → Full refund
 * - Less than threshold hours before session → No refund
 *
 * ## Fee Considerations
 *
 * When processing refunds via Stripe:
 * - Platform fee (10%) is NOT refunded by default
 * - Full refunds require `refund_application_fee: true`
 * - The coach's portion is automatically deducted from their balance
 *
 * @example
 * ```typescript
 * import { calculateRefundEligibility, getRefundMessage } from '@/lib/refunds';
 *
 * // Check if client can get a refund
 * const eligibility = calculateRefundEligibility(
 *   new Date('2026-02-01T14:00:00Z'), // Session time
 *   5000,                              // $50.00 paid
 *   24                                 // 24-hour threshold
 * );
 *
 * if (eligibility.isEligible) {
 *   // Process refund via Stripe
 *   await stripe.refunds.create({
 *     payment_intent: paymentIntentId,
 *     amount: eligibility.refundAmountCents,
 *   });
 * }
 *
 * // Get user-friendly message for UI
 * const message = getRefundMessage(eligibility);
 * // { title: 'Full refund available', description: 'You will receive...' }
 * ```
 *
 * @see {@link src/app/(dashboard)/dashboard/sessions/actions.ts | Coach session cancellation}
 * @see {@link src/app/(dashboard)/dashboard/my-sessions/actions.ts | Client session cancellation}
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Result of refund eligibility calculation.
 *
 * Contains all information needed to process a refund and display
 * appropriate messaging to the user.
 *
 * @property isEligible - Whether the cancellation qualifies for any refund
 * @property refundAmountCents - Amount to refund in cents (0 if not eligible)
 * @property refundPercentage - Percentage of original payment (0, 50, or 100)
 * @property reason - Human-readable explanation for the eligibility decision
 * @property hoursUntilSession - Hours until session start (negative if past)
 *
 * @example
 * ```typescript
 * // Full refund eligible
 * {
 *   isEligible: true,
 *   refundAmountCents: 5000,
 *   refundPercentage: 100,
 *   reason: 'Cancelled with more than 24 hours notice',
 *   hoursUntilSession: 48.5
 * }
 *
 * // No refund (too late)
 * {
 *   isEligible: false,
 *   refundAmountCents: 0,
 *   refundPercentage: 0,
 *   reason: 'Cancelled within 24 hours of session',
 *   hoursUntilSession: 12.3
 * }
 * ```
 */
export interface RefundEligibility {
  isEligible: boolean;
  refundAmountCents: number;
  refundPercentage: number;
  reason: string;
  hoursUntilSession: number;
}

// ============================================================================
// REFUND CALCULATION
// ============================================================================

/**
 * Calculates refund eligibility based on cancellation timing.
 *
 * This is the core function for determining whether a client can receive
 * a refund when cancelling a session. The calculation is based on how
 * far in advance the cancellation is made.
 *
 * ## Refund Tiers
 *
 * | Time Before Session | Refund |
 * |---------------------|--------|
 * | > threshold hours   | 100%   |
 * | < threshold hours   | 0%     |
 * | Session passed      | 0%     |
 *
 * ## Calculation Logic
 *
 * ```
 * hoursUntilSession = (sessionStartTime - now) / (1000 * 60 * 60)
 *
 * if (hoursUntilSession < 0) → Session passed, no refund
 * if (hoursUntilSession >= threshold) → Full refund
 * else → No refund
 * ```
 *
 * @param sessionStartTime - The scheduled start time of the session
 * @param paidAmountCents - The amount paid in cents (e.g., 5000 for $50.00)
 * @param cancellationThresholdHours - Hours before session for full refund eligibility (default: 24)
 *
 * @returns RefundEligibility object with calculation results
 *
 * @example
 * ```typescript
 * // Session 48 hours away, $100 paid, 24-hour threshold
 * const result = calculateRefundEligibility(
 *   new Date(Date.now() + 48 * 60 * 60 * 1000),
 *   10000,
 *   24
 * );
 * // { isEligible: true, refundAmountCents: 10000, refundPercentage: 100, ... }
 *
 * // Session 12 hours away
 * const result = calculateRefundEligibility(
 *   new Date(Date.now() + 12 * 60 * 60 * 1000),
 *   10000,
 *   24
 * );
 * // { isEligible: false, refundAmountCents: 0, refundPercentage: 0, ... }
 * ```
 *
 * @remarks
 * - This function only calculates eligibility; it does NOT process refunds
 * - For coach cancellations, use 100% refund regardless of timing
 * - All monetary values are in cents to avoid floating-point precision issues
 * - The threshold can be customized per coach in future iterations
 *
 * @see {@link getRefundMessage} For user-friendly refund messages
 */
export function calculateRefundEligibility(
  sessionStartTime: Date,
  paidAmountCents: number,
  cancellationThresholdHours: number = 24
): RefundEligibility {
  const now = new Date();
  const msUntilSession = sessionStartTime.getTime() - now.getTime();
  // Convert milliseconds to hours for comparison against threshold
  const hoursUntilSession = msUntilSession / (1000 * 60 * 60);

  // Session is in the past - no refund possible
  // This handles edge cases where the page was left open past session time
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
  // Client cancelled early enough to allow coach to potentially rebook the slot
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
  // Too late for coach to find a replacement client
  return {
    isEligible: false,
    refundAmountCents: 0,
    refundPercentage: 0,
    reason: `Cancelled within ${cancellationThresholdHours} hours of session`,
    hoursUntilSession,
  };
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Formats a refund amount in cents for user display.
 *
 * Converts the internal cents representation to a locale-formatted
 * currency string using the Intl.NumberFormat API.
 *
 * @param amountCents - Amount in cents (e.g., 5000 for $50.00)
 * @param currency - ISO 4217 currency code (default: 'USD')
 *
 * @returns Formatted currency string (e.g., '$50.00')
 *
 * @example
 * ```typescript
 * formatRefundAmount(5000);        // '$50.00'
 * formatRefundAmount(5000, 'EUR'); // '€50.00'
 * formatRefundAmount(12345);       // '$123.45'
 * formatRefundAmount(0);           // '$0.00'
 * ```
 *
 * @remarks
 * - Uses 'en-US' locale for consistent formatting
 * - Currency code is normalized to uppercase
 * - Always shows 2 decimal places
 */
export function formatRefundAmount(amountCents: number, currency: string = 'USD'): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

// ============================================================================
// UI MESSAGE GENERATION
// ============================================================================

/**
 * Generates user-friendly refund messaging for cancellation dialogs.
 *
 * Returns title and description text suitable for displaying in
 * confirmation modals or alert dialogs when a user attempts to
 * cancel a session.
 *
 * ## Message Scenarios
 *
 * | Condition | Title | Description |
 * |-----------|-------|-------------|
 * | Free/unpaid session | 'No refund applicable' | 'This session is free...' |
 * | Eligible for refund | 'Full refund available' | 'You will receive...$X' |
 * | Not eligible | 'No refund available' | 'Cancelled within 24...' |
 *
 * @param eligibility - RefundEligibility result from calculateRefundEligibility
 * @param currency - ISO 4217 currency code for formatting (default: 'USD')
 *
 * @returns Object with title and description strings for UI display
 *
 * @example
 * ```typescript
 * // In a cancellation confirmation dialog
 * const eligibility = calculateRefundEligibility(sessionTime, 5000, 24);
 * const message = getRefundMessage(eligibility);
 *
 * // Display in dialog
 * <AlertDialog>
 *   <AlertDialogTitle>{message.title}</AlertDialogTitle>
 *   <AlertDialogDescription>{message.description}</AlertDialogDescription>
 * </AlertDialog>
 *
 * // Eligible result:
 * // { title: 'Full refund available', description: 'You will receive a full refund of $50.00.' }
 *
 * // Not eligible result:
 * // { title: 'No refund available', description: 'Cancelled within 24 hours of the scheduled session time.' }
 * ```
 *
 * @remarks
 * - Used in both coach and client cancellation flows
 * - Free sessions (paidAmount = 0) get a special message
 * - The 24-hour text is hardcoded; update if threshold becomes configurable
 *
 * @see {@link calculateRefundEligibility} For generating the eligibility object
 * @see {@link formatRefundAmount} For currency formatting
 */
export function getRefundMessage(
  eligibility: RefundEligibility,
  currency: string = 'USD'
): { title: string; description: string } {
  // Free session or payment not yet made
  // This can happen for free intro sessions or if Stripe checkout wasn't completed
  if (eligibility.refundAmountCents === 0 && eligibility.hoursUntilSession >= 0) {
    return {
      title: 'No refund applicable',
      description: 'This session is free or has not been paid for.',
    };
  }

  // Client is eligible for refund (cancelled with sufficient notice)
  if (eligibility.isEligible) {
    const formattedAmount = formatRefundAmount(eligibility.refundAmountCents, currency);
    return {
      title: 'Full refund available',
      description: `You will receive a full refund of ${formattedAmount}.`,
    };
  }

  // Client is not eligible (cancelled too close to session time)
  return {
    title: 'No refund available',
    description: 'Cancelled within 24 hours of the scheduled session time.',
  };
}
