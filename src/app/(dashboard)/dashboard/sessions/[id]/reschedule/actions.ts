'use server';

import { auth } from '@clerk/nextjs/server';
import { db, bookings, users, coachProfiles, coachAvailability, availabilityOverrides } from '@/db';
import { eq, and, gte, lte, or, ne } from 'drizzle-orm';
import type { BookingSessionType } from '@/db/schema';

// Types for the reschedule flow
export interface RescheduleBookingData {
  id: number;
  coachId: string;
  coachName: string;
  coachAvatarUrl: string | null;
  coachHeadline: string | null;
  coachTimezone: string;
  coachCurrency: string;
  coachSlug: string;
  sessionType: BookingSessionType;
  originalStartTime: Date;
  originalEndTime: Date;
  bufferMinutes: number;
  advanceNoticeHours: number;
  maxAdvanceDays: number;
}

export interface TimeSlot {
  startTime: string; // ISO string
  endTime: string; // ISO string
  displayTime: string; // Formatted for display
  isOriginalSlot?: boolean; // True if this is the current booking slot
}

// Get booking data for reschedule flow
export async function getRescheduleBookingData(
  bookingId: number
): Promise<{ success: true; data: RescheduleBookingData } | { success: false; error: string }> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'You must be signed in' };
    }

    // Fetch the booking - only the client can reschedule
    const bookingData = await db
      .select({
        id: bookings.id,
        coachId: bookings.coachId,
        clientId: bookings.clientId,
        sessionType: bookings.sessionType,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.clientId, userId)))
      .limit(1);

    if (bookingData.length === 0) {
      return { success: false, error: 'Booking not found' };
    }

    const booking = bookingData[0];

    // Check if booking can be rescheduled
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return { success: false, error: 'This session cannot be rescheduled' };
    }

    if (new Date(booking.startTime) <= new Date()) {
      return { success: false, error: 'Cannot reschedule a past session' };
    }

    // Get coach profile info
    const coachResult = await db
      .select({
        userId: coachProfiles.userId,
        slug: coachProfiles.slug,
        headline: coachProfiles.headline,
        timezone: coachProfiles.timezone,
        currency: coachProfiles.currency,
        bufferMinutes: coachProfiles.bufferMinutes,
        advanceNoticeHours: coachProfiles.advanceNoticeHours,
        maxAdvanceDays: coachProfiles.maxAdvanceDays,
        coachName: users.name,
        coachAvatarUrl: users.avatarUrl,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(coachProfiles.userId, users.id))
      .where(eq(coachProfiles.userId, booking.coachId))
      .limit(1);

    if (coachResult.length === 0) {
      return { success: false, error: 'Coach not found' };
    }

    const coach = coachResult[0];

    // Check advance notice - client must reschedule at least advanceNoticeHours before the session
    const now = new Date();
    const hoursUntilSession =
      (new Date(booking.startTime).getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilSession < coach.advanceNoticeHours) {
      return {
        success: false,
        error: `Reschedule must be done at least ${coach.advanceNoticeHours} hours before the session`,
      };
    }

    return {
      success: true,
      data: {
        id: booking.id,
        coachId: booking.coachId,
        coachName: coach.coachName || 'Coach',
        coachAvatarUrl: coach.coachAvatarUrl,
        coachHeadline: coach.headline,
        coachTimezone: coach.timezone || 'America/New_York',
        coachCurrency: coach.currency || 'USD',
        coachSlug: coach.slug,
        sessionType: booking.sessionType,
        originalStartTime: booking.startTime,
        originalEndTime: booking.endTime,
        bufferMinutes: coach.bufferMinutes,
        advanceNoticeHours: coach.advanceNoticeHours,
        maxAdvanceDays: coach.maxAdvanceDays,
      },
    };
  } catch (error) {
    console.error('Error fetching reschedule booking data:', error);
    return { success: false, error: 'Failed to load booking data' };
  }
}

// Get bookable dates for reschedule (same as booking flow but excludes current booking)
export async function getRescheduleBookableDates(
  coachId: string,
  currentBookingId: number,
  month: number,
  year: number
): Promise<{ success: true; data: string[] } | { success: false; error: string }> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'You must be signed in' };
    }

    // Get coach profile for max advance days
    const profiles = await db
      .select({
        maxAdvanceDays: coachProfiles.maxAdvanceDays,
        advanceNoticeHours: coachProfiles.advanceNoticeHours,
      })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, coachId))
      .limit(1);

    if (profiles.length === 0) {
      return { success: false, error: 'Coach not found' };
    }

    const profile = profiles[0];

    // Get weekly availability
    const weeklyAvail = await db
      .select({
        dayOfWeek: coachAvailability.dayOfWeek,
        isAvailable: coachAvailability.isAvailable,
      })
      .from(coachAvailability)
      .where(eq(coachAvailability.coachId, coachId));

    // Create a map of available days of the week
    const availableDays = new Set(weeklyAvail.filter((a) => a.isAvailable).map((a) => a.dayOfWeek));

    // Get overrides for this month
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-31`;

    const overrides = await db
      .select({
        date: availabilityOverrides.date,
        isAvailable: availabilityOverrides.isAvailable,
      })
      .from(availabilityOverrides)
      .where(
        and(
          eq(availabilityOverrides.coachId, coachId),
          gte(availabilityOverrides.date, monthStart),
          lte(availabilityOverrides.date, monthEnd)
        )
      );

    const overrideMap = new Map(overrides.map((o) => [o.date, o.isAvailable]));

    // Calculate bookable dates
    const now = new Date();
    const minDate = new Date(now.getTime() + profile.advanceNoticeHours * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + profile.maxAdvanceDays * 24 * 60 * 60 * 1000);

    const bookableDates: string[] = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = date.getDay();

      // Check date constraints
      if (date < minDate || date > maxDate) {
        continue;
      }

      // Check override first
      if (overrideMap.has(dateStr)) {
        if (overrideMap.get(dateStr)) {
          bookableDates.push(dateStr);
        }
        continue;
      }

      // Check weekly availability
      if (availableDays.has(dayOfWeek)) {
        bookableDates.push(dateStr);
      }
    }

    return { success: true, data: bookableDates };
  } catch (error) {
    console.error('Error getting bookable dates:', error);
    return { success: false, error: 'Failed to get bookable dates' };
  }
}

// Get available time slots for reschedule, excluding the current booking
export async function getRescheduleAvailableSlots(
  coachId: string,
  currentBookingId: number,
  dateStr: string,
  sessionDuration: number,
  _coachTimezone: string, // Prefixed with _ as it's kept for API consistency but not used
  clientTimezone: string,
  originalStartTime: Date
): Promise<{ success: true; data: TimeSlot[] } | { success: false; error: string }> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'You must be signed in' };
    }

    // Parse the date string
    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const dayOfWeek = targetDate.getDay();

    // Get coach profile for buffer, advance notice
    const profiles = await db
      .select({
        bufferMinutes: coachProfiles.bufferMinutes,
        advanceNoticeHours: coachProfiles.advanceNoticeHours,
      })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, coachId))
      .limit(1);

    if (profiles.length === 0) {
      return { success: false, error: 'Coach not found' };
    }

    const profile = profiles[0];

    // Check for date-specific override
    const overrides = await db
      .select()
      .from(availabilityOverrides)
      .where(
        and(eq(availabilityOverrides.coachId, coachId), eq(availabilityOverrides.date, dateStr))
      )
      .limit(1);

    let dayStartTime: string;
    let dayEndTime: string;
    let isAvailable: boolean;

    if (overrides.length > 0) {
      // Use override
      const override = overrides[0];
      isAvailable = override.isAvailable;
      dayStartTime = override.startTime?.substring(0, 5) || '09:00';
      dayEndTime = override.endTime?.substring(0, 5) || '17:00';
    } else {
      // Get regular weekly availability
      const weeklyAvail = await db
        .select()
        .from(coachAvailability)
        .where(
          and(eq(coachAvailability.coachId, coachId), eq(coachAvailability.dayOfWeek, dayOfWeek))
        )
        .limit(1);

      if (weeklyAvail.length === 0) {
        return { success: true, data: [] }; // No availability set
      }

      const avail = weeklyAvail[0];
      isAvailable = avail.isAvailable;
      dayStartTime = avail.startTime.substring(0, 5);
      dayEndTime = avail.endTime.substring(0, 5);
    }

    if (!isAvailable) {
      return { success: true, data: [] }; // Coach not available on this day
    }

    // Get existing bookings for this date, EXCLUDING the current booking being rescheduled
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBookings = await db
      .select({
        id: bookings.id,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.coachId, coachId),
          gte(bookings.startTime, startOfDay),
          lte(bookings.startTime, endOfDay),
          or(eq(bookings.status, 'pending'), eq(bookings.status, 'confirmed')),
          ne(bookings.id, currentBookingId) // Exclude the current booking
        )
      );

    // Generate time slots
    const slots: TimeSlot[] = [];
    const [startHour, startMin] = dayStartTime.split(':').map(Number);
    const [endHour, endMin] = dayEndTime.split(':').map(Number);

    const slotStartBase = new Date(targetDate);
    slotStartBase.setHours(startHour, startMin, 0, 0);

    const slotEnd = new Date(targetDate);
    slotEnd.setHours(endHour, endMin, 0, 0);

    // Calculate minimum start time based on advance notice
    const now = new Date();
    const minStartTime = new Date(now.getTime() + profile.advanceNoticeHours * 60 * 60 * 1000);

    let currentSlot = new Date(slotStartBase);

    // Check if the original booking date matches the target date
    const originalDateStr = `${originalStartTime.getFullYear()}-${String(originalStartTime.getMonth() + 1).padStart(2, '0')}-${String(originalStartTime.getDate()).padStart(2, '0')}`;
    const isOriginalDate = originalDateStr === dateStr;

    while (currentSlot.getTime() + sessionDuration * 60 * 1000 <= slotEnd.getTime()) {
      const slotEndTime = new Date(currentSlot.getTime() + sessionDuration * 60 * 1000);

      // Check if slot is in the future with advance notice
      if (currentSlot >= minStartTime) {
        // Check if slot conflicts with existing bookings (including buffer)
        const slotWithBuffer = {
          start: new Date(currentSlot.getTime() - profile.bufferMinutes * 60 * 1000),
          end: new Date(slotEndTime.getTime() + profile.bufferMinutes * 60 * 1000),
        };

        const hasConflict = existingBookings.some((booking) => {
          const bookingStart = new Date(booking.startTime);
          const bookingEnd = new Date(booking.endTime);
          // Check overlap (accounting for buffer)
          return slotWithBuffer.start < bookingEnd && slotWithBuffer.end > bookingStart;
        });

        if (!hasConflict) {
          // Format display time in client's timezone
          const displayTime = formatTimeInTimezone(currentSlot, clientTimezone);

          // Check if this is the original booking slot
          let isOriginalSlot = false;
          if (isOriginalDate) {
            // Compare times (ignore milliseconds)
            const originalStartMs =
              originalStartTime.getHours() * 60 + originalStartTime.getMinutes();
            const slotStartMs = currentSlot.getHours() * 60 + currentSlot.getMinutes();
            isOriginalSlot = originalStartMs === slotStartMs;
          }

          slots.push({
            startTime: currentSlot.toISOString(),
            endTime: slotEndTime.toISOString(),
            displayTime,
            isOriginalSlot,
          });
        }
      }

      // Move to next slot (30 minute increments)
      currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000);
    }

    return { success: true, data: slots };
  } catch (error) {
    console.error('Error calculating available slots:', error);
    return { success: false, error: 'Failed to calculate available slots' };
  }
}

// Helper function to format time in a specific timezone
function formatTimeInTimezone(date: Date, timezone: string): string {
  try {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });
  } catch {
    // Fallback if timezone is invalid
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}

// Confirm the reschedule - update the booking with new times
export async function confirmReschedule(
  bookingId: number,
  newStartTime: string,
  newEndTime: string
): Promise<{ success: true; data: { id: number } } | { success: false; error: string }> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'You must be signed in' };
    }

    // Verify the booking belongs to this user and is valid
    const bookingData = await db
      .select({
        id: bookings.id,
        clientId: bookings.clientId,
        coachId: bookings.coachId,
        status: bookings.status,
        startTime: bookings.startTime,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.clientId, userId)))
      .limit(1);

    if (bookingData.length === 0) {
      return { success: false, error: 'Booking not found' };
    }

    const booking = bookingData[0];

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return { success: false, error: 'This session cannot be rescheduled' };
    }

    // Get coach profile for advance notice check
    const profiles = await db
      .select({
        advanceNoticeHours: coachProfiles.advanceNoticeHours,
      })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, booking.coachId))
      .limit(1);

    if (profiles.length === 0) {
      return { success: false, error: 'Coach not found' };
    }

    const profile = profiles[0];

    // Check advance notice for original booking
    const now = new Date();
    const hoursUntilOriginalSession =
      (new Date(booking.startTime).getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilOriginalSession < profile.advanceNoticeHours) {
      return {
        success: false,
        error: `Reschedule must be done at least ${profile.advanceNoticeHours} hours before the session`,
      };
    }

    // Parse new times
    const startTime = new Date(newStartTime);
    const endTime = new Date(newEndTime);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return { success: false, error: 'Invalid booking times' };
    }

    if (startTime >= endTime) {
      return { success: false, error: 'Start time must be before end time' };
    }

    if (startTime < new Date()) {
      return { success: false, error: 'Cannot reschedule to a past time' };
    }

    // Check advance notice for new time
    const hoursUntilNewSession = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursUntilNewSession < profile.advanceNoticeHours) {
      return {
        success: false,
        error: `New session time must be at least ${profile.advanceNoticeHours} hours from now`,
      };
    }

    // Update the booking
    const updated = await db
      .update(bookings)
      .set({
        startTime,
        endTime,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning({ id: bookings.id });

    if (updated.length === 0) {
      return { success: false, error: 'Failed to update booking' };
    }

    return { success: true, data: { id: updated[0].id } };
  } catch (error) {
    console.error('Error confirming reschedule:', error);
    return { success: false, error: 'Failed to reschedule booking' };
  }
}
