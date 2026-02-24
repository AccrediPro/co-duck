/**
 * @fileoverview Get Coach Availability for Date API
 *
 * Returns available time slots for a specific coach on a given date.
 *
 * @module api/coaches/[slug]/availability/[date]
 */

import { db } from '@/db';
import { coachProfiles, coachAvailability, availabilityOverrides, bookings } from '@/db/schema';
import { eq, and, gte, lt, inArray } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ slug: string; date: string }>;
}

/**
 * GET /api/coaches/:slug/availability/:date
 *
 * Returns available time slots for a coach on a specific date.
 *
 * @param {string} slug - Coach's URL slug
 * @param {string} date - Date in YYYY-MM-DD format
 * @query {number} [duration=60] - Session duration in minutes
 *
 * @returns {Object} Available time slots
 *
 * @example Response
 * {
 *   "success": true,
 *   "data": {
 *     "date": "2024-01-15",
 *     "timezone": "America/New_York",
 *     "slots": [
 *       { "start": "09:00", "end": "10:00", "available": true },
 *       { "start": "10:00", "end": "11:00", "available": false },
 *       ...
 *     ]
 *   }
 * }
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { slug, date } = await params;
    const { searchParams } = new URL(request.url);
    const duration = parseInt(searchParams.get('duration') || '60');

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return Response.json(
        {
          success: false,
          error: { code: 'INVALID_DATE', message: 'Date must be in YYYY-MM-DD format' },
        },
        { status: 400 }
      );
    }

    // Get coach profile
    const coach = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.slug, slug),
    });

    if (!coach) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Coach not found' } },
        { status: 404 }
      );
    }

    if (!coach.isPublished) {
      return Response.json(
        {
          success: false,
          error: { code: 'NOT_PUBLISHED', message: 'Coach profile is not published' },
        },
        { status: 404 }
      );
    }

    // Parse the requested date
    const requestedDate = new Date(date + 'T00:00:00');
    const dayOfWeek = requestedDate.getDay();

    // Check for date override
    const override = await db.query.availabilityOverrides.findFirst({
      where: and(
        eq(availabilityOverrides.coachId, coach.userId),
        eq(availabilityOverrides.date, date)
      ),
    });

    let startTime: string | null = null;
    let endTime: string | null = null;
    let isAvailable = false;

    if (override) {
      // Use override settings
      isAvailable = override.isAvailable;
      startTime = override.startTime;
      endTime = override.endTime;
    } else {
      // Use weekly schedule
      const weeklySlot = await db.query.coachAvailability.findFirst({
        where: and(
          eq(coachAvailability.coachId, coach.userId),
          eq(coachAvailability.dayOfWeek, dayOfWeek)
        ),
      });

      if (weeklySlot) {
        isAvailable = weeklySlot.isAvailable;
        startTime = weeklySlot.startTime;
        endTime = weeklySlot.endTime;
      }
    }

    // If not available on this day, return empty slots
    if (!isAvailable || !startTime || !endTime) {
      return Response.json({
        success: true,
        data: {
          date,
          timezone: coach.timezone || 'UTC',
          slots: [],
        },
      });
    }

    // Get existing bookings for this day
    const dayStart = new Date(date + 'T00:00:00Z');
    const dayEnd = new Date(date + 'T23:59:59Z');

    const existingBookings = await db
      .select({
        startTime: bookings.startTime,
        endTime: bookings.endTime,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.coachId, coach.userId),
          gte(bookings.startTime, dayStart),
          lt(bookings.startTime, dayEnd),
          inArray(bookings.status, ['pending', 'confirmed'])
        )
      );

    // Generate time slots
    const slots = generateTimeSlots(
      startTime,
      endTime,
      duration,
      coach.bufferMinutes,
      existingBookings,
      date,
      coach.advanceNoticeHours
    );

    return Response.json({
      success: true,
      data: {
        date,
        timezone: coach.timezone || 'UTC',
        slots,
      },
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch availability' },
      },
      { status: 500 }
    );
  }
}

/**
 * Generate available time slots for a day
 */
function generateTimeSlots(
  startTime: string,
  endTime: string,
  duration: number,
  bufferMinutes: number,
  existingBookings: { startTime: Date; endTime: Date }[],
  date: string,
  advanceNoticeHours: number
): { start: string; end: string; available: boolean }[] {
  const slots: { start: string; end: string; available: boolean }[] = [];

  // Parse start/end times (format: "HH:MM:SS" or "HH:MM")
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const slotDuration = duration + bufferMinutes;
  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  const now = new Date();
  const minBookingTime = new Date(now.getTime() + advanceNoticeHours * 60 * 60 * 1000);

  while (currentMinutes + duration <= endMinutes) {
    const slotStart = formatTime(currentMinutes);
    const slotEnd = formatTime(currentMinutes + duration);

    // Create slot datetime for comparison
    const slotDateTime = new Date(`${date}T${slotStart}:00`);

    // Check if slot is in the past or within advance notice window
    const isPast = slotDateTime < minBookingTime;

    // Check if slot conflicts with existing bookings
    const hasConflict = existingBookings.some((booking) => {
      const bookingStart = booking.startTime.getTime();
      const bookingEnd = booking.endTime.getTime();
      const slotStartMs = slotDateTime.getTime();
      const slotEndMs = new Date(`${date}T${slotEnd}:00`).getTime();

      return slotStartMs < bookingEnd && slotEndMs > bookingStart;
    });

    slots.push({
      start: slotStart,
      end: slotEnd,
      available: !isPast && !hasConflict,
    });

    currentMinutes += slotDuration;
  }

  return slots;
}

/**
 * Format minutes to HH:MM string
 */
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}
