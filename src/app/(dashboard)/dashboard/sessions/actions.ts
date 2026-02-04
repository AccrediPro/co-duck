/**
 * @fileoverview Coach session management server actions.
 *
 * This module provides server actions for coaches to manage their sessions:
 * - View sessions by status (upcoming, past, cancelled)
 * - Mark sessions as complete
 * - Cancel sessions with automatic refund processing
 * - Save and retrieve session notes
 * - Update meeting links
 * - Generate ICS calendar files
 * - Check refund eligibility
 *
 * @module sessions/actions
 *
 * @security
 * All actions require authentication via Clerk.
 * Coaches can only access/modify sessions where they are the coach.
 *
 * @refunds
 * Coach-initiated cancellations always result in FULL refunds to clients.
 * Refunds are processed via Stripe Refunds API with metadata tracking.
 */
'use server';

import { auth } from '@clerk/nextjs/server';
import { eq, and, or, gte, lt, desc, asc, sql } from 'drizzle-orm';
import { db, bookings, users, transactions, coachProfiles, sessionNotes } from '@/db';
import type { BookingSessionType } from '@/db/schema';
import { stripe } from '@/lib/stripe';
import { formatRefundAmount } from '@/lib/refunds';
import { removeBookingFromCalendar, updateBookingInCalendar } from '@/lib/google-calendar-sync';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Session tab status for filtering coach's session list.
 * - `upcoming`: Future sessions that are pending or confirmed
 * - `past`: Sessions that have already occurred
 * - `cancelled`: Sessions that were cancelled by coach or client
 */
export type SessionStatus = 'upcoming' | 'past' | 'cancelled';

/**
 * Payment status derived from transaction existence and status.
 * - `free`: Session has price of 0, no payment required
 * - `paid`: Transaction exists with 'succeeded' status
 * - `payment_required`: Paid session with no successful transaction
 * - `payment_failed`: Transaction exists with 'failed' status
 */
export type PaymentStatus = 'free' | 'paid' | 'payment_required' | 'payment_failed';

/**
 * Session data with client information for coach's view.
 * Combines booking data with client user profile.
 */
export interface SessionWithClient {
  id: number;
  clientId: string;
  clientName: string | null;
  clientAvatar: string | null;
  clientEmail: string;
  sessionType: BookingSessionType;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  clientNotes: string | null;
  coachNotes: string | null;
  createdAt: Date;
  paymentStatus: PaymentStatus;
}

/**
 * Result of fetching coach sessions.
 */
export interface GetSessionsResult {
  success: boolean;
  /** List of sessions when successful */
  sessions?: SessionWithClient[];
  /** Total count for pagination (before limit/offset applied) */
  totalCount?: number;
  /** Error message when success is false */
  error?: string;
}

// ============================================================================
// Session Query Actions
// ============================================================================

/**
 * Retrieves paginated sessions for the authenticated coach.
 *
 * Sessions are filtered by tab status and ordered appropriately:
 * - `upcoming`: Ascending by startTime (nearest first)
 * - `past`: Descending by startTime (most recent first)
 * - `cancelled`: Descending by startTime
 *
 * @param tab - Filter by session status ('upcoming', 'past', 'cancelled')
 * @param page - Page number for pagination (1-indexed, default: 1)
 * @param perPage - Number of sessions per page (default: 10)
 * @returns Promise with sessions array, total count, or error
 *
 * @example
 * // Get first page of upcoming sessions
 * const result = await getCoachSessions('upcoming');
 * if (result.success) {
 *   console.log(`Found ${result.totalCount} total sessions`);
 *   result.sessions?.forEach(s => console.log(s.clientName));
 * }
 */
export async function getCoachSessions(
  tab: SessionStatus,
  page: number = 1,
  perPage: number = 10
): Promise<GetSessionsResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  const now = new Date();
  const offset = (page - 1) * perPage;

  try {
    // Build the status filter based on tab
    let statusCondition;
    let orderDirection: typeof desc | typeof asc = desc;

    if (tab === 'upcoming') {
      // Upcoming: future sessions with confirmed or pending status
      statusCondition = and(
        eq(bookings.coachId, userId),
        gte(bookings.startTime, now),
        or(eq(bookings.status, 'confirmed'), eq(bookings.status, 'pending'))
      );
      orderDirection = asc; // Nearest session first
    } else if (tab === 'past') {
      // Past: sessions that already happened (completed, no_show, or confirmed but in past)
      statusCondition = and(
        eq(bookings.coachId, userId),
        lt(bookings.startTime, now),
        or(
          eq(bookings.status, 'completed'),
          eq(bookings.status, 'no_show'),
          eq(bookings.status, 'confirmed'),
          eq(bookings.status, 'pending')
        )
      );
      orderDirection = desc; // Most recent first
    } else {
      // Cancelled: all cancelled sessions
      statusCondition = and(eq(bookings.coachId, userId), eq(bookings.status, 'cancelled'));
      orderDirection = desc;
    }

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(statusCondition);

    const totalCount = countResult[0]?.count || 0;

    // Get sessions with client info
    const sessionsData = await db
      .select({
        id: bookings.id,
        clientId: bookings.clientId,
        clientName: users.name,
        clientAvatar: users.avatarUrl,
        clientEmail: users.email,
        sessionType: bookings.sessionType,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
        clientNotes: bookings.clientNotes,
        coachNotes: bookings.coachNotes,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.clientId, users.id))
      .where(statusCondition)
      .orderBy(orderDirection(bookings.startTime))
      .limit(perPage)
      .offset(offset);

    // Get payment status for each session
    const sessionsWithPayment: SessionWithClient[] = await Promise.all(
      sessionsData.map(async (session) => {
        const sessionType = session.sessionType as BookingSessionType;

        // Free sessions (price = 0) don't require payment
        if (sessionType.price === 0) {
          return { ...session, paymentStatus: 'free' as PaymentStatus };
        }

        // Check for a transaction for this booking
        const transactionResult = await db
          .select({ status: transactions.status })
          .from(transactions)
          .where(eq(transactions.bookingId, session.id))
          .limit(1);

        if (transactionResult.length === 0) {
          return { ...session, paymentStatus: 'payment_required' as PaymentStatus };
        }

        const txStatus = transactionResult[0].status;
        if (txStatus === 'succeeded') {
          return { ...session, paymentStatus: 'paid' as PaymentStatus };
        } else if (txStatus === 'failed') {
          return { ...session, paymentStatus: 'payment_failed' as PaymentStatus };
        } else {
          return { ...session, paymentStatus: 'payment_required' as PaymentStatus };
        }
      })
    );

    return {
      success: true,
      sessions: sessionsWithPayment,
      totalCount,
    };
  } catch {
    return { success: false, error: 'Failed to fetch sessions' };
  }
}

// ============================================================================
// Session Status Actions
// ============================================================================

/**
 * Result of marking a session as complete.
 */
export interface MarkCompleteResult {
  success: boolean;
  /** Error message when success is false */
  error?: string;
}

/**
 * Marks a past session as completed.
 *
 * This action is used by coaches to finalize sessions that have occurred.
 * The session must meet the following criteria:
 * - Belongs to the authenticated coach
 * - Start time is in the past
 * - Current status is 'pending' or 'confirmed'
 *
 * @param sessionId - The booking ID to mark as complete
 * @returns Promise indicating success or error
 *
 * @throws Returns error if session is in the future
 * @throws Returns error if session is already completed/cancelled
 *
 * @example
 * const result = await markSessionComplete(123);
 * if (!result.success) {
 *   console.error(result.error);
 * }
 */
export async function markSessionComplete(sessionId: number): Promise<MarkCompleteResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify the session belongs to this coach and is in a valid state
    const existingBooking = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, sessionId), eq(bookings.coachId, userId)))
      .limit(1);

    if (existingBooking.length === 0) {
      return { success: false, error: 'Session not found' };
    }

    const booking = existingBooking[0];

    // Only allow marking as complete if session is in the past
    if (booking.startTime > new Date()) {
      return { success: false, error: 'Cannot mark a future session as complete' };
    }

    // Only allow completing confirmed or pending sessions
    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      return { success: false, error: 'Session cannot be marked as complete in its current state' };
    }

    // Update the session status
    await db.update(bookings).set({ status: 'completed' }).where(eq(bookings.id, sessionId));

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to mark session as complete' };
  }
}

// ============================================================================
// Cancellation Actions
// ============================================================================

/**
 * Information about a refund processed during cancellation.
 */
export interface RefundInfo {
  /** Whether a refund was successfully processed */
  wasRefunded: boolean;
  /** Refund amount in cents */
  refundAmountCents: number;
  /** Formatted refund amount (e.g., "$25.00") */
  refundAmountFormatted: string;
  /** Explanation of refund outcome */
  reason: string;
}

/**
 * Result of cancelling a session.
 */
export interface CancelSessionResult {
  success: boolean;
  /** Error message when success is false */
  error?: string;
  /** Refund details if a paid session was cancelled */
  refund?: RefundInfo;
}

/**
 * Cancels a session as the coach.
 *
 * Coach-initiated cancellations ALWAYS result in a FULL refund to the client.
 * This is different from client cancellations which follow a sliding scale
 * based on how close to the session the cancellation occurs.
 *
 * Process:
 * 1. Verify session belongs to coach and is in cancellable state
 * 2. Check for paid transaction
 * 3. If paid, process full refund via Stripe
 * 4. Update booking status to 'cancelled'
 * 5. Record cancellation metadata (who, when, reason)
 *
 * @param sessionId - The booking ID to cancel
 * @param reason - Optional cancellation reason for records
 * @returns Promise with success status and refund details if applicable
 *
 * @throws Returns error if session is already cancelled/completed
 *
 * @example
 * const result = await cancelSession(123, "Schedule conflict");
 * if (result.success && result.refund?.wasRefunded) {
 *   console.log(`Refunded ${result.refund.refundAmountFormatted}`);
 * }
 */
export async function cancelSession(
  sessionId: number,
  reason?: string
): Promise<CancelSessionResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify the session belongs to this coach
    const existingBooking = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, sessionId), eq(bookings.coachId, userId)))
      .limit(1);

    if (existingBooking.length === 0) {
      return { success: false, error: 'Session not found' };
    }

    const booking = existingBooking[0];

    // Only allow cancelling confirmed or pending sessions
    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      return { success: false, error: 'Session cannot be cancelled in its current state' };
    }

    // Check if there's a paid transaction for this booking
    const transactionResult = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.bookingId, sessionId), eq(transactions.status, 'succeeded')))
      .limit(1);

    let refundInfo: RefundInfo | undefined;

    // If there's a paid transaction, process refund
    // Coach cancellations always get full refund for the client
    if (transactionResult.length > 0) {
      const transaction = transactionResult[0];

      // Get coach currency for formatting
      const coachResult = await db
        .select({ currency: coachProfiles.currency })
        .from(coachProfiles)
        .where(eq(coachProfiles.userId, userId))
        .limit(1);
      const currency = coachResult[0]?.currency || 'USD';

      // Coach cancellations always result in full refund
      const refundAmountCents = transaction.amountCents;

      if (transaction.stripePaymentIntentId) {
        try {
          // Create refund via Stripe
          await stripe.refunds.create({
            payment_intent: transaction.stripePaymentIntentId,
            amount: refundAmountCents,
            reason: 'requested_by_customer',
            metadata: {
              bookingId: sessionId.toString(),
              cancelledBy: 'coach',
              cancelledByUserId: userId,
            },
          });

          // Update transaction status
          await db
            .update(transactions)
            .set({
              status: 'refunded',
              refundAmountCents: refundAmountCents,
            })
            .where(eq(transactions.id, transaction.id));

          refundInfo = {
            wasRefunded: true,
            refundAmountCents,
            refundAmountFormatted: formatRefundAmount(refundAmountCents, currency),
            reason: 'Coach cancelled - full refund issued',
          };
        } catch (stripeError) {
          console.error('Stripe refund failed:', stripeError);
          // Continue with cancellation but note refund failure
          refundInfo = {
            wasRefunded: false,
            refundAmountCents: 0,
            refundAmountFormatted: '$0.00',
            reason: 'Refund processing failed - please contact support',
          };
        }
      }
    }

    // Update the session status
    await db
      .update(bookings)
      .set({
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: new Date(),
        cancellationReason: reason || null,
      })
      .where(eq(bookings.id, sessionId));

    // Remove from Google Calendar
    removeBookingFromCalendar(sessionId).catch((error) => {
      console.error('Error removing cancelled session from calendar:', error);
    });

    return { success: true, refund: refundInfo };
  } catch {
    return { success: false, error: 'Failed to cancel session' };
  }
}

// ============================================================================
// Client History Actions
// ============================================================================

/**
 * Gets the count of past sessions between the coach and a specific client.
 *
 * Useful for displaying coaching history in session details, such as
 * "This is your 5th session with this client."
 *
 * Counts sessions that:
 * - Have a startTime in the past
 * - Have status: completed, confirmed, or pending
 *
 * @param clientId - The Clerk user ID of the client
 * @returns Promise with count or error
 *
 * @example
 * const result = await getPastSessionsCountWithClient("user_123");
 * if (result.success) {
 *   console.log(`${result.count} previous sessions`);
 * }
 */
export async function getPastSessionsCountWithClient(
  clientId: string
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.coachId, userId),
          eq(bookings.clientId, clientId),
          lt(bookings.startTime, new Date()),
          or(
            eq(bookings.status, 'completed'),
            eq(bookings.status, 'confirmed'),
            eq(bookings.status, 'pending')
          )
        )
      );

    return { success: true, count: countResult[0]?.count || 0 };
  } catch {
    return { success: false, error: 'Failed to get session count' };
  }
}

// ============================================================================
// Session Notes Actions
// ============================================================================

/**
 * Result of saving a session note.
 */
export interface SaveSessionNoteResult {
  success: boolean;
  /** Error message when success is false */
  error?: string;
}

/**
 * Saves or updates a session note for a booking.
 *
 * Notes are stored in the `session_notes` table, separate from the booking.
 * If a note already exists for the booking, it will be updated; otherwise
 * a new note is created (upsert behavior).
 *
 * Notes are private to the coach and not visible to clients.
 *
 * @param bookingId - The booking ID to save notes for
 * @param content - The note content (plain text)
 * @returns Promise indicating success or error
 *
 * @example
 * const result = await saveSessionNote(123, "Client made great progress today");
 * if (!result.success) {
 *   console.error("Failed to save notes:", result.error);
 * }
 */
export async function saveSessionNote(
  bookingId: number,
  content: string
): Promise<SaveSessionNoteResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify the booking belongs to this coach
    const existingBooking = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.coachId, userId)))
      .limit(1);

    if (existingBooking.length === 0) {
      return { success: false, error: 'Session not found' };
    }

    // Check if a note already exists for this booking
    const existingNote = await db
      .select()
      .from(sessionNotes)
      .where(eq(sessionNotes.bookingId, bookingId))
      .limit(1);

    if (existingNote.length > 0) {
      // Update existing note
      await db
        .update(sessionNotes)
        .set({ content: content || '' })
        .where(eq(sessionNotes.bookingId, bookingId));
    } else {
      // Create new note
      await db.insert(sessionNotes).values({
        bookingId,
        coachId: userId,
        content: content || '',
      });
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to save notes' };
  }
}

/**
 * Result of retrieving a session note.
 */
export interface GetSessionNoteResult {
  success: boolean;
  /** The note content, or null if no note exists */
  content?: string | null;
  /** Error message when success is false */
  error?: string;
}

/**
 * Retrieves the session note for a booking.
 *
 * @param bookingId - The booking ID to get notes for
 * @returns Promise with note content or error
 *
 * @example
 * const result = await getSessionNote(123);
 * if (result.success && result.content) {
 *   console.log("Notes:", result.content);
 * }
 */
export async function getSessionNote(bookingId: number): Promise<GetSessionNoteResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify the booking belongs to this coach
    const existingBooking = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.coachId, userId)))
      .limit(1);

    if (existingBooking.length === 0) {
      return { success: false, error: 'Session not found' };
    }

    // Get the note
    const note = await db
      .select({ content: sessionNotes.content })
      .from(sessionNotes)
      .where(eq(sessionNotes.bookingId, bookingId))
      .limit(1);

    return {
      success: true,
      content: note.length > 0 ? note[0].content : null,
    };
  } catch {
    return { success: false, error: 'Failed to get notes' };
  }
}

/**
 * @deprecated Use SaveSessionNoteResult instead.
 * Legacy type alias for backward compatibility.
 */
export type SaveCoachNotesResult = SaveSessionNoteResult;

/**
 * @deprecated Use saveSessionNote instead.
 * Legacy function alias for backward compatibility.
 */
export const saveCoachNotes = saveSessionNote;

// ============================================================================
// Meeting Link Actions
// ============================================================================

/**
 * Result of updating a meeting link.
 */
export interface UpdateMeetingLinkResult {
  success: boolean;
  /** Error message when success is false */
  error?: string;
}

/**
 * Updates the meeting link for a booking.
 *
 * Meeting links are used for virtual coaching sessions (Zoom, Google Meet, etc.).
 * The link must be a valid HTTPS URL.
 *
 * Validation:
 * - Link must start with "https://"
 * - Link must be a valid URL format
 * - Empty string clears the meeting link
 *
 * @param bookingId - The booking ID to update
 * @param meetingLink - The HTTPS meeting URL, or empty string to clear
 * @returns Promise indicating success or error
 *
 * @throws Returns error if URL doesn't start with https://
 * @throws Returns error if URL format is invalid
 *
 * @example
 * const result = await updateMeetingLink(123, "https://zoom.us/j/123456");
 * if (!result.success) {
 *   console.error(result.error);
 * }
 */
export async function updateMeetingLink(
  bookingId: number,
  meetingLink: string
): Promise<UpdateMeetingLinkResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Verify the booking belongs to this coach
    const existingBooking = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.coachId, userId)))
      .limit(1);

    if (existingBooking.length === 0) {
      return { success: false, error: 'Session not found' };
    }

    // Validate URL format if not empty
    const trimmedLink = meetingLink.trim();
    if (trimmedLink) {
      // Must start with https://
      if (!trimmedLink.startsWith('https://')) {
        return { success: false, error: 'Meeting link must start with https://' };
      }
      // Basic URL validation
      try {
        new URL(trimmedLink);
      } catch {
        return { success: false, error: 'Invalid URL format' };
      }
    }

    // Update the meeting link
    await db
      .update(bookings)
      .set({ meetingLink: trimmedLink || null })
      .where(eq(bookings.id, bookingId));

    // Update in Google Calendar
    updateBookingInCalendar(bookingId).catch((error) => {
      console.error('Error updating meeting link in calendar:', error);
    });

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to update meeting link' };
  }
}

// ============================================================================
// Calendar Export Actions
// ============================================================================

/**
 * Generates an ICS (iCalendar) file for a booking.
 *
 * The ICS file allows coaches to download and import session details
 * into their calendar application (Google Calendar, Outlook, etc.).
 *
 * ICS Format:
 * - Uses RFC 5545 iCalendar specification
 * - UID format: booking-{id}@coachingplatform.com (for deduplication)
 * - Includes session type name, duration, and client notes
 *
 * @param bookingId - The booking ID to generate ICS for
 * @returns Promise with ICS file content string or error
 *
 * @example
 * const result = await generateCoachIcsFile(123);
 * if (result.success) {
 *   // Serve as downloadable file
 *   const blob = new Blob([result.data], { type: 'text/calendar' });
 * }
 */
export async function generateCoachIcsFile(
  bookingId: number
): Promise<{ success: true; data: string } | { success: false; error: string }> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Get the booking details (must belong to this coach)
    const booking = await db
      .select({
        id: bookings.id,
        coachId: bookings.coachId,
        clientId: bookings.clientId,
        sessionType: bookings.sessionType,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        clientNotes: bookings.clientNotes,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.coachId, userId)))
      .limit(1);

    if (booking.length === 0) {
      return { success: false, error: 'Booking not found' };
    }

    const bookingData = booking[0];

    // Get client info
    const client = await db
      .select({
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, bookingData.clientId))
      .limit(1);

    const clientName = client.length > 0 ? client[0].name || 'Client' : 'Client';

    // Format dates for ICS (YYYYMMDDTHHMMSSZ)
    const formatIcsDate = (date: Date) => {
      return date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    };

    const sessionType = bookingData.sessionType as BookingSessionType;

    // Generate ICS content
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Coaching Platform//Booking//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:booking-${bookingData.id}@coachingplatform.com`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(bookingData.startTime)}`,
      `DTEND:${formatIcsDate(bookingData.endTime)}`,
      `SUMMARY:Coaching Session with ${clientName}`,
      `DESCRIPTION:${sessionType.name} (${sessionType.duration} minutes)${bookingData.clientNotes ? '\\n\\nClient Notes: ' + bookingData.clientNotes.replace(/\n/g, '\\n') : ''}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    return { success: true, data: icsContent };
  } catch {
    return { success: false, error: 'Failed to generate calendar file' };
  }
}

// ============================================================================
// Refund Eligibility Actions
// ============================================================================

/**
 * Result of checking refund eligibility for a session.
 */
export interface RefundEligibilityResult {
  success: boolean;
  /** Error message when success is false */
  error?: string;
  /** Refund eligibility data when success is true */
  data?: {
    /** Whether a successful payment exists */
    hasPaidTransaction: boolean;
    /** Amount paid in cents */
    paidAmountCents: number;
    /** Currency code (e.g., "USD") */
    currency: string;
    /** Whether a refund can be issued */
    isEligibleForRefund: boolean;
    /** Amount to refund in cents */
    refundAmountCents: number;
    /** Formatted refund amount (e.g., "$25.00") */
    refundAmountFormatted: string;
    /** Explanation of refund policy */
    refundReason: string;
    /** Always true when coach is checking (context flag) */
    isCoachCancelling: boolean;
  };
}

/**
 * Gets refund eligibility information for a session.
 *
 * Used by the cancellation dialog to show the coach what refund
 * will be issued if they cancel. For coach-initiated cancellations,
 * the refund is always 100% of the paid amount.
 *
 * @param sessionId - The booking ID to check
 * @returns Promise with refund eligibility details or error
 *
 * @example
 * const result = await getRefundEligibility(123);
 * if (result.success && result.data?.hasPaidTransaction) {
 *   console.log(`Client will receive ${result.data.refundAmountFormatted} refund`);
 * }
 */
export async function getRefundEligibility(sessionId: number): Promise<RefundEligibilityResult> {
  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Get the booking (must belong to this coach)
    const existingBooking = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, sessionId), eq(bookings.coachId, userId)))
      .limit(1);

    if (existingBooking.length === 0) {
      return { success: false, error: 'Session not found' };
    }

    // Get coach currency
    const coachResult = await db
      .select({ currency: coachProfiles.currency })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);
    const currency = coachResult[0]?.currency || 'USD';

    // Check for paid transaction
    const transactionResult = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.bookingId, sessionId), eq(transactions.status, 'succeeded')))
      .limit(1);

    if (transactionResult.length === 0) {
      // No paid transaction
      return {
        success: true,
        data: {
          hasPaidTransaction: false,
          paidAmountCents: 0,
          currency,
          isEligibleForRefund: false,
          refundAmountCents: 0,
          refundAmountFormatted: formatRefundAmount(0, currency),
          refundReason: 'No payment on file',
          isCoachCancelling: true,
        },
      };
    }

    const transaction = transactionResult[0];

    // Coach cancellations always result in full refund
    return {
      success: true,
      data: {
        hasPaidTransaction: true,
        paidAmountCents: transaction.amountCents,
        currency,
        isEligibleForRefund: true,
        refundAmountCents: transaction.amountCents,
        refundAmountFormatted: formatRefundAmount(transaction.amountCents, currency),
        refundReason: 'Coach cancelled - full refund will be issued',
        isCoachCancelling: true,
      },
    };
  } catch {
    return { success: false, error: 'Failed to get refund eligibility' };
  }
}
