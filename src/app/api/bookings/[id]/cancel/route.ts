/**
 * @fileoverview Cancel Booking API
 *
 * Cancels a booking.
 *
 * @module api/bookings/[id]/cancel
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { bookings, users } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import { CancellationEmail } from '@/lib/emails';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/bookings/:id/cancel
 *
 * Cancels a booking.
 * User must be the coach or client of the booking.
 * Only pending or confirmed bookings can be cancelled.
 *
 * @param {string} id - Booking ID
 * @body {string} [reason] - Cancellation reason
 *
 * @returns {Object} Cancelled booking
 */
export async function POST(request: Request, { params }: RouteParams) {
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
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

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

    // Check if booking can be cancelled
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return Response.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'This booking cannot be cancelled' } },
        { status: 400 }
      );
    }

    // Update booking
    const [cancelledBooking] = await db
      .update(bookings)
      .set({
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: new Date(),
        cancellationReason: reason || null,
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    // Send cancellation emails to both client and coach
    try {
      // Get coach and client user data
      const [coachUser, clientUser] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, booking.coachId) }),
        db.query.users.findFirst({ where: eq(users.id, booking.clientId) }),
      ]);

      if (coachUser && clientUser) {
        const sessionType = booking.sessionType as { name: string; duration: number; price: number };
        const startTime = new Date(booking.startTime);

        const emailData = {
          coachName: coachUser.name || 'Coach',
          sessionType: sessionType.name,
          date: startTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          time: startTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          duration: sessionType.duration,
          price: sessionType.price / 100, // Convert cents to dollars
          refundAmount: sessionType.price / 100, // Assume full refund for now
          refundStatus: 'pending' as const,
          cancelledBy: userId === booking.coachId ? 'coach' as const : 'client' as const,
          reason: reason || undefined,
        };

        // Send email to client
        const clientEmailResult = await sendEmail({
          to: clientUser.email,
          subject: `Session Cancelled: ${sessionType.name} with ${emailData.coachName}`,
          react: CancellationEmail(emailData),
        });

        if (!clientEmailResult.success) {
          console.error('[Booking] Failed to send cancellation email to client:', clientEmailResult.error);
        }

        // Send email to coach
        const coachEmailResult = await sendEmail({
          to: coachUser.email,
          subject: `Session Cancelled: ${sessionType.name} with ${clientUser.name || 'Client'}`,
          react: CancellationEmail({
            ...emailData,
            coachName: clientUser.name || 'Client', // For coach, show client name
          }),
        });

        if (!coachEmailResult.success) {
          console.error('[Booking] Failed to send cancellation email to coach:', coachEmailResult.error);
        }
      }
    } catch (emailError) {
      // Log email errors but don't fail the cancellation
      console.error('[Booking] Error sending cancellation emails:', emailError);
    }

    return Response.json({
      success: true,
      data: {
        id: cancelledBooking.id,
        status: cancelledBooking.status,
        cancelledBy: cancelledBooking.cancelledBy,
        cancelledAt: cancelledBooking.cancelledAt,
        cancellationReason: cancelledBooking.cancellationReason,
      },
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel booking' } },
      { status: 500 }
    );
  }
}
