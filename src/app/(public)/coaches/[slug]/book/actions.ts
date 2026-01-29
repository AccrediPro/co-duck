'use server';

import { db, users, coachProfiles, coachAvailability, bookings, availabilityOverrides } from '@/db';
import { eq, and, gte, lte, or } from 'drizzle-orm';
import type { SessionType } from '@/db/schema';

// Types for the booking flow
export interface CoachBookingData {
  userId: string;
  name: string;
  avatarUrl: string | null;
  headline: string | null;
  timezone: string;
  currency: string;
  sessionTypes: SessionType[];
  bufferMinutes: number;
  advanceNoticeHours: number;
  maxAdvanceDays: number;
}

export interface DayAvailability {
  dayOfWeek: number;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isAvailable: boolean;
}

export interface TimeSlot {
  startTime: string; // ISO string
  endTime: string; // ISO string
  displayTime: string; // Formatted for display
}

// Fetch coach data for booking
export async function getCoachForBooking(
  slug: string
): Promise<{ success: true; data: CoachBookingData } | { success: false; error: string }> {
  try {
    const result = await db
      .select({
        userId: coachProfiles.userId,
        name: users.name,
        avatarUrl: users.avatarUrl,
        headline: coachProfiles.headline,
        timezone: coachProfiles.timezone,
        currency: coachProfiles.currency,
        sessionTypes: coachProfiles.sessionTypes,
        bufferMinutes: coachProfiles.bufferMinutes,
        advanceNoticeHours: coachProfiles.advanceNoticeHours,
        maxAdvanceDays: coachProfiles.maxAdvanceDays,
        isPublished: coachProfiles.isPublished,
      })
      .from(coachProfiles)
      .innerJoin(users, eq(coachProfiles.userId, users.id))
      .where(and(eq(coachProfiles.slug, slug), eq(coachProfiles.isPublished, true)))
      .limit(1);

    if (result.length === 0) {
      return { success: false, error: 'Coach not found' };
    }

    const coach = result[0];

    if (!coach.sessionTypes || coach.sessionTypes.length === 0) {
      return { success: false, error: 'Coach has no session types available' };
    }

    return {
      success: true,
      data: {
        userId: coach.userId,
        name: coach.name || 'Coach',
        avatarUrl: coach.avatarUrl,
        headline: coach.headline,
        timezone: coach.timezone || 'America/New_York',
        currency: coach.currency || 'USD',
        sessionTypes: coach.sessionTypes,
        bufferMinutes: coach.bufferMinutes,
        advanceNoticeHours: coach.advanceNoticeHours,
        maxAdvanceDays: coach.maxAdvanceDays,
      },
    };
  } catch (error) {
    console.error('Error fetching coach for booking:', error);
    return { success: false, error: 'Failed to load coach data' };
  }
}

// Fetch coach's weekly availability
export async function getCoachWeeklyAvailability(
  coachId: string
): Promise<{ success: true; data: DayAvailability[] } | { success: false; error: string }> {
  try {
    const availability = await db
      .select({
        dayOfWeek: coachAvailability.dayOfWeek,
        startTime: coachAvailability.startTime,
        endTime: coachAvailability.endTime,
        isAvailable: coachAvailability.isAvailable,
      })
      .from(coachAvailability)
      .where(eq(coachAvailability.coachId, coachId));

    // Build full week array with defaults for missing days
    const weekAvailability: DayAvailability[] = [];
    for (let i = 0; i < 7; i++) {
      const record = availability.find((a) => a.dayOfWeek === i);
      if (record) {
        weekAvailability.push({
          dayOfWeek: record.dayOfWeek,
          startTime: record.startTime.substring(0, 5), // Remove seconds
          endTime: record.endTime.substring(0, 5),
          isAvailable: record.isAvailable,
        });
      } else {
        // Default to unavailable
        weekAvailability.push({
          dayOfWeek: i,
          startTime: '09:00',
          endTime: '17:00',
          isAvailable: false,
        });
      }
    }

    return { success: true, data: weekAvailability };
  } catch (error) {
    console.error('Error fetching weekly availability:', error);
    return { success: false, error: 'Failed to load availability' };
  }
}

// Get available time slots for a specific date
export async function getAvailableSlots(
  coachId: string,
  dateStr: string, // YYYY-MM-DD format
  sessionDuration: number, // in minutes
  coachTimezone: string,
  clientTimezone: string
): Promise<{ success: true; data: TimeSlot[] } | { success: false; error: string }> {
  try {
    // Parse the date string
    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const dayOfWeek = targetDate.getDay();

    // Get coach profile for buffer, advance notice, max days
    const profiles = await db
      .select({
        bufferMinutes: coachProfiles.bufferMinutes,
        advanceNoticeHours: coachProfiles.advanceNoticeHours,
        maxAdvanceDays: coachProfiles.maxAdvanceDays,
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

    // Get existing bookings for this date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingBookings = await db
      .select({
        startTime: bookings.startTime,
        endTime: bookings.endTime,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.coachId, coachId),
          gte(bookings.startTime, startOfDay),
          lte(bookings.startTime, endOfDay),
          or(eq(bookings.status, 'pending'), eq(bookings.status, 'confirmed'))
        )
      );

    // Generate time slots
    const slots: TimeSlot[] = [];
    const [startHour, startMin] = dayStartTime.split(':').map(Number);
    const [endHour, endMin] = dayEndTime.split(':').map(Number);

    // Create date objects in coach's timezone
    // We'll work in UTC and convert for display
    const slotStartBase = new Date(targetDate);
    slotStartBase.setHours(startHour, startMin, 0, 0);

    const slotEnd = new Date(targetDate);
    slotEnd.setHours(endHour, endMin, 0, 0);

    // Calculate minimum start time based on advance notice
    const now = new Date();
    const minStartTime = new Date(now.getTime() + profile.advanceNoticeHours * 60 * 60 * 1000);

    let currentSlot = new Date(slotStartBase);

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

          slots.push({
            startTime: currentSlot.toISOString(),
            endTime: slotEndTime.toISOString(),
            displayTime,
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

// Check if a date is bookable (not past, not beyond max days, coach has availability)
export async function getBookableDates(
  coachId: string,
  month: number, // 0-indexed
  year: number
): Promise<{ success: true; data: string[] } | { success: false; error: string }> {
  try {
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
