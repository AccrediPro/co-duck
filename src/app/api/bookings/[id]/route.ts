/**
 * @fileoverview Get Booking Details API
 *
 * Returns details of a specific booking.
 *
 * @module api/bookings/[id]
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { bookings, users, coachProfiles } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import { ReviewRequestEmail } from '@/lib/emails';
import { createNotification } from '@/lib/notifications';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';
import { rateLimit, FREQUENT_LIMIT, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { formatDateLong } from '@/lib/date-utils';
import { recordStreakActivity } from '@/lib/streaks';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/bookings/:id
 *
 * Returns details of a specific booking.
 * User must be the coach or client of the booking.
 *
 * @param {string} id - Booking ID
 *
 * @returns {Object} Booking details
 */
export async function GET(request: Request, { params }: RouteParams) {
  const rl = rateLimit(request, FREQUENT_LIMIT, 'bookings-get');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const bookingId = parseInt(id);

    if (isNaN(bookingId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid booking ID' } },
        { status: 400 }
      );
    }

    // Get booking with access check
    const booking = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.id, bookingId),
        or(eq(bookings.coachId, userId), eq(bookings.clientId, userId))
      ),
    });

    if (!booking) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Get coach and client info
    const [coach, client] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, booking.coachId) }),
      db.query.users.findFirst({ where: eq(users.id, booking.clientId) }),
    ]);

    return Response.json({
      success: true,
      data: {
        id: booking.id,
        status: booking.status,
        sessionType: booking.sessionType,
        startTime: booking.startTime,
        endTime: booking.endTime,
        clientNotes: booking.clientNotes,
        coachNotes: booking.coachId === userId ? booking.coachNotes : null, // Only show to coach
        meetingLink: booking.meetingLink,
        cancelledBy: booking.cancelledBy,
        cancelledAt: booking.cancelledAt,
        cancellationReason: booking.cancellationReason,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        coach: coach
          ? {
              id: coach.id,
              name: coach.name,
              email: coach.email,
              avatarUrl: coach.avatarUrl,
            }
          : null,
        client: client
          ? {
              id: client.id,
              name: client.name,
              email: client.email,
              avatarUrl: client.avatarUrl,
            }
          : null,
        isCoach: booking.coachId === userId,
      },
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch booking' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bookings/:id
 *
 * Updates a booking (meeting link, notes, etc.).
 * Coach can update meeting link and coach notes.
 *
 * @param {string} id - Booking ID
 * @body {string} [meetingLink] - Video meeting URL
 * @body {string} [coachNotes] - Private coach notes
 *
 * @returns {Object} Updated booking
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const rlp = rateLimit(request, WRITE_LIMIT, 'bookings-patch');
  if (!rlp.success) return rateLimitResponse(rlp);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const bookingId = parseInt(id);
    const body = await request.json();

    if (isNaN(bookingId)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_ID', message: 'Invalid booking ID' } },
        { status: 400 }
      );
    }

    // Get booking
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Check access
    const isCoach = booking.coachId === userId;
    const isClient = booking.clientId === userId;

    if (!isCoach && !isClient) {
      return Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: Partial<typeof booking> = {};

    // Coach-only updates
    if (isCoach) {
      if (body.meetingLink !== undefined) {
        updateData.meetingLink = body.meetingLink;
      }
      if (body.coachNotes !== undefined) {
        updateData.coachNotes = body.coachNotes;
      }
      if (body.status === 'completed' && booking.status === 'confirmed') {
        updateData.status = 'completed';
      }
      if (body.status === 'no_show' && booking.status === 'confirmed') {
        updateData.status = 'no_show';
      }
    }

    // Client can update client notes before session
    if (isClient && body.clientNotes !== undefined && booking.status === 'pending') {
      updateData.clientNotes = body.clientNotes;
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { success: false, error: { code: 'NO_UPDATES', message: 'No valid updates provided' } },
        { status: 400 }
      );
    }

    // Update booking
    const [updatedBooking] = await db
      .update(bookings)
      .set(updateData)
      .where(eq(bookings.id, bookingId))
      .returning();

    // Record streak activity on session completion (fire-and-forget)
    if (updateData.status === 'completed') {
      recordStreakActivity(booking.clientId, 'session_completed', String(booking.id)).catch(
        console.error
      );
    }

    // Notify client when session is completed and send review request email
    if (updateData.status === 'completed') {
      createNotification({
        userId: booking.clientId,
        type: 'session_completed',
        title: 'Session completed',
        body: 'Your coaching session has been marked as complete. Leave a review!',
        link: `/dashboard/my-sessions/${bookingId}`,
      });
      const [client, coach, coachProfile] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, booking.clientId) }),
        db.query.users.findFirst({ where: eq(users.id, booking.coachId) }),
        db.query.coachProfiles.findFirst({ where: eq(coachProfiles.userId, booking.coachId) }),
      ]);

      if (client?.email && coach && coachProfile) {
        const sessionType = booking.sessionType as {
          name: string;
          duration: number;
          price: number;
        } | null;
        sendEmail({
          to: client.email,
          subject: `How was your session with ${coach.name || 'your coach'}?`,
          react: ReviewRequestEmail({
            clientName: client.name || 'there',
            coachName: coach.name || 'Your Coach',
            sessionType: sessionType?.name || 'Coaching',
            sessionDate: formatDateLong(booking.startTime),
            coachSlug: coachProfile.slug,
            unsubscribeUrl: getUnsubscribeUrl(booking.clientId, 'reviews'),
          }),
        }).catch((err) => {
          console.error('Failed to send review request email:', err);
        });
      }
    }

    return Response.json({
      success: true,
      data: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        meetingLink: updatedBooking.meetingLink,
        clientNotes: updatedBooking.clientNotes,
        coachNotes: isCoach ? updatedBooking.coachNotes : null,
        updatedAt: updatedBooking.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update booking' } },
      { status: 500 }
    );
  }
}
