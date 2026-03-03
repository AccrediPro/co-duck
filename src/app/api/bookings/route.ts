/**
 * @fileoverview Bookings API
 *
 * Create and list bookings for the authenticated user.
 *
 * @module api/bookings
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { bookings, users, coachProfiles } from '@/db/schema';
import { eq, or, desc, and, gte, lt, inArray, sql } from 'drizzle-orm';
import { sendEmail } from '@/lib/email';
import { BookingConfirmationEmail } from '@/lib/emails';
import { rateLimit, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';
import { formatDateLong, formatTime } from '@/lib/date-utils';

/**
 * GET /api/bookings
 *
 * Returns the authenticated user's bookings (as coach or client).
 *
 * @query {string} [status] - Filter by status (pending, confirmed, completed, cancelled)
 * @query {string} [role] - Filter by role (coach, client) - defaults to both
 * @query {string} [upcoming] - If "true", only return future bookings
 * @query {number} [page=1] - Page number
 * @query {number} [limit=20] - Items per page
 *
 * @returns {Object} Paginated booking list
 */
export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const upcoming = searchParams.get('upcoming') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    // Build conditions
    const conditions = [];

    // Role filter
    if (role === 'coach') {
      conditions.push(eq(bookings.coachId, userId));
    } else if (role === 'client') {
      conditions.push(eq(bookings.clientId, userId));
    } else {
      conditions.push(or(eq(bookings.coachId, userId), eq(bookings.clientId, userId)));
    }

    // Status filter
    if (status) {
      conditions.push(
        eq(
          bookings.status,
          status as 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
        )
      );
    }

    // Upcoming filter
    if (upcoming) {
      conditions.push(gte(bookings.startTime, new Date()));
    }

    const offset = (page - 1) * limit;

    // Get total count and paginated bookings in parallel
    const [countResult, paginatedBookings] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookings)
        .where(and(...conditions)),
      db
        .select()
        .from(bookings)
        .where(and(...conditions))
        .orderBy(desc(bookings.startTime))
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.count ?? 0;

    // Get user info only for the paginated bookings
    const userIds = Array.from(new Set(paginatedBookings.flatMap((b) => [b.coachId, b.clientId])));
    const usersData = userIds.length
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const usersMap = new Map(usersData.map((u) => [u.id, u]));

    // Format response
    const formattedBookings = paginatedBookings.map((booking) => {
      const coach = usersMap.get(booking.coachId);
      const client = usersMap.get(booking.clientId);

      return {
        id: booking.id,
        status: booking.status,
        sessionType: booking.sessionType,
        startTime: booking.startTime,
        endTime: booking.endTime,
        clientNotes: booking.clientNotes,
        meetingLink: booking.meetingLink,
        cancelledBy: booking.cancelledBy,
        cancelledAt: booking.cancelledAt,
        cancellationReason: booking.cancellationReason,
        createdAt: booking.createdAt,
        coach: coach
          ? {
              id: coach.id,
              name: coach.name,
              avatarUrl: coach.avatarUrl,
            }
          : null,
        client: client
          ? {
              id: client.id,
              name: client.name,
              avatarUrl: client.avatarUrl,
            }
          : null,
        isCoach: booking.coachId === userId,
      };
    });

    return Response.json({
      success: true,
      data: {
        bookings: formattedBookings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bookings' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings
 *
 * Creates a new booking.
 *
 * @body {string} coachId - Coach's user ID
 * @body {string} sessionTypeId - Session type ID from coach's profile
 * @body {string} startTime - ISO datetime string
 * @body {string} [clientNotes] - Optional notes from client
 *
 * @returns {Object} Created booking
 */
export async function POST(request: Request) {
  // Rate limit: 10 requests per minute
  const rl = rateLimit(request, WRITE_LIMIT, 'bookings-create');
  if (!rl.success) return rateLimitResponse(rl);

  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { coachId, sessionTypeId, startTime, clientNotes } = body;

    // Validate required fields
    if (!coachId || !sessionTypeId || !startTime) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'coachId, sessionTypeId, and startTime are required',
          },
        },
        { status: 400 }
      );
    }

    // Prevent self-booking
    if (coachId === userId) {
      return Response.json(
        { success: false, error: { code: 'SELF_BOOKING', message: 'Cannot book yourself' } },
        { status: 400 }
      );
    }

    // Get coach profile
    const coach = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.userId, coachId),
    });

    if (!coach) {
      return Response.json(
        { success: false, error: { code: 'COACH_NOT_FOUND', message: 'Coach not found' } },
        { status: 404 }
      );
    }

    if (!coach.isPublished) {
      return Response.json(
        {
          success: false,
          error: { code: 'COACH_NOT_AVAILABLE', message: 'Coach is not accepting bookings' },
        },
        { status: 400 }
      );
    }

    // Find session type
    const sessionType = (
      coach.sessionTypes as { id: string; name: string; duration: number; price: number }[]
    )?.find((st) => st.id === sessionTypeId);

    if (!sessionType) {
      return Response.json(
        {
          success: false,
          error: { code: 'SESSION_TYPE_NOT_FOUND', message: 'Session type not found' },
        },
        { status: 404 }
      );
    }

    // Parse and validate start time
    const startDateTime = new Date(startTime);
    if (isNaN(startDateTime.getTime())) {
      return Response.json(
        { success: false, error: { code: 'INVALID_TIME', message: 'Invalid start time' } },
        { status: 400 }
      );
    }

    // Calculate end time
    const endDateTime = new Date(startDateTime.getTime() + sessionType.duration * 60 * 1000);

    // Check for conflicting bookings
    const conflictingBooking = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.coachId, coachId),
        inArray(bookings.status, ['pending', 'confirmed']),
        lt(bookings.startTime, endDateTime),
        gte(bookings.endTime, startDateTime)
      ),
    });

    if (conflictingBooking) {
      return Response.json(
        {
          success: false,
          error: { code: 'TIME_CONFLICT', message: 'This time slot is no longer available' },
        },
        { status: 409 }
      );
    }

    // Create booking
    const [newBooking] = await db
      .insert(bookings)
      .values({
        coachId,
        clientId: userId,
        sessionType: {
          name: sessionType.name,
          duration: sessionType.duration,
          price: sessionType.price,
        },
        startTime: startDateTime,
        endTime: endDateTime,
        status: 'pending',
        clientNotes: clientNotes || null,
      })
      .returning();

    // Send confirmation emails to both client and coach
    try {
      // Get coach and client user data
      const [coachUser, clientUser] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, coachId) }),
        db.query.users.findFirst({ where: eq(users.id, userId) }),
      ]);

      if (coachUser && clientUser) {
        const emailData = {
          coachName: coachUser.name || 'Your Coach',
          sessionType: sessionType.name,
          date: formatDateLong(startDateTime),
          time: formatTime(startDateTime),
          duration: sessionType.duration,
          price: sessionType.price / 100, // Convert cents to dollars
          meetingLink: newBooking.meetingLink || undefined,
        };

        // Send email to client
        const clientEmailResult = await sendEmail({
          to: clientUser.email,
          subject: `Booking Confirmed: ${sessionType.name} with ${emailData.coachName}`,
          react: BookingConfirmationEmail({
            ...emailData,
            unsubscribeUrl: getUnsubscribeUrl(userId, 'bookings'),
          }),
        });

        if (!clientEmailResult.success) {
          console.error(
            '[Booking] Failed to send confirmation email to client:',
            clientEmailResult.error
          );
        }

        // Send email to coach
        const coachEmailResult = await sendEmail({
          to: coachUser.email,
          subject: `New Booking: ${sessionType.name} with ${clientUser.name || 'Client'}`,
          react: BookingConfirmationEmail({
            ...emailData,
            coachName: clientUser.name || 'A client', // For coach, show client name
            unsubscribeUrl: getUnsubscribeUrl(coachId, 'bookings'),
          }),
        });

        if (!coachEmailResult.success) {
          console.error(
            '[Booking] Failed to send confirmation email to coach:',
            coachEmailResult.error
          );
        }
      }
    } catch (emailError) {
      // Log email errors but don't fail the booking
      console.error('[Booking] Error sending confirmation emails:', emailError);
    }

    return Response.json({
      success: true,
      data: {
        id: newBooking.id,
        status: newBooking.status,
        sessionType: newBooking.sessionType,
        startTime: newBooking.startTime,
        endTime: newBooking.endTime,
        clientNotes: newBooking.clientNotes,
        createdAt: newBooking.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create booking' } },
      { status: 500 }
    );
  }
}
