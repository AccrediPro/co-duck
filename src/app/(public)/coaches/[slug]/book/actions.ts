/**
 * @fileoverview Booking Flow Server Actions - Availability & Time Slot Management
 *
 * This module handles the first phase of the booking flow: fetching coach information,
 * retrieving availability, and calculating available time slots for session booking.
 *
 * ## Booking Flow Overview
 * 1. **This file**: Get coach data, weekly availability, and available time slots
 * 2. `confirm/actions.ts`: Create booking and Stripe Checkout session
 * 3. `success/actions.ts`: Handle post-payment confirmation and display
 *
 * ## Key Features
 * - Respects coach timezone settings
 * - Handles availability overrides (vacation days, special hours)
 * - Applies buffer time between sessions
 * - Enforces advance notice requirements
 * - Calculates available slots avoiding conflicts with existing bookings
 *
 * @module booking/actions
 */

'use server';

import { db, users, coachProfiles, coachAvailability, bookings, availabilityOverrides } from '@/db';
import { eq, and, gte, lte, or } from 'drizzle-orm';
import type { SessionType } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coach data required for the booking flow.
 * Contains essential information for displaying the booking page and calculating slots.
 */
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

/**
 * Availability settings for a single day of the week.
 * Used to represent the coach's recurring weekly schedule.
 */
export interface DayAvailability {
  /** Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) */
  dayOfWeek: number;
  /** Start time in HH:MM format (24-hour, e.g., "09:00") */
  startTime: string;
  /** End time in HH:MM format (24-hour, e.g., "17:00") */
  endTime: string;
  /** Whether the coach accepts bookings on this day */
  isAvailable: boolean;
}

/**
 * An available time slot for booking.
 * Contains both machine-readable ISO timestamps and human-readable display format.
 */
export interface TimeSlot {
  /** Session start time as ISO 8601 string (e.g., "2024-01-15T14:00:00.000Z") */
  startTime: string;
  /** Session end time as ISO 8601 string */
  endTime: string;
  /** Formatted time for display in client's timezone (e.g., "2:00 PM") */
  displayTime: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches coach data required for the booking page.
 *
 * Retrieves the coach's profile, session types, and booking configuration.
 * Only returns data for published coaches with at least one session type.
 *
 * @param slug - The coach's URL slug (unique identifier from their profile)
 * @returns Success with CoachBookingData, or error if coach not found/unavailable
 *
 * @throws Will not throw - errors are returned in the result object
 *
 * @example
 * const result = await getCoachForBooking('john-smith');
 * if (result.success) {
 *   console.log(result.data.sessionTypes); // Available session types
 * }
 */
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

/**
 * Retrieves the coach's recurring weekly availability schedule.
 *
 * Returns availability for all 7 days of the week. Days without explicit
 * availability records default to unavailable (09:00-17:00).
 *
 * @param coachId - The coach's user ID
 * @returns Success with array of 7 DayAvailability objects (Sun-Sat), or error
 *
 * @example
 * const result = await getCoachWeeklyAvailability('user_abc123');
 * if (result.success) {
 *   const mondayAvail = result.data.find(d => d.dayOfWeek === 1);
 *   console.log(mondayAvail?.isAvailable); // true/false
 * }
 */
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

/**
 * Calculates available time slots for a specific date.
 *
 * This is the core slot calculation function that considers:
 * - Coach's weekly availability schedule
 * - Date-specific overrides (vacation days, special hours)
 * - Existing bookings (pending or confirmed)
 * - Buffer time between sessions
 * - Advance notice requirements
 * - Session duration
 *
 * ## Slot Generation Logic
 * 1. Check for date-specific override, otherwise use weekly schedule
 * 2. Generate 30-minute increment slots within available window
 * 3. Filter out slots that don't meet advance notice requirement
 * 4. Filter out slots that conflict with existing bookings (including buffer)
 *
 * @param coachId - The coach's user ID
 * @param dateStr - Target date in YYYY-MM-DD format (e.g., "2024-01-15")
 * @param sessionDuration - Session length in minutes (e.g., 30, 60, 90)
 * @param coachTimezone - Coach's IANA timezone (e.g., "America/New_York")
 * @param clientTimezone - Client's IANA timezone for display formatting
 * @returns Success with array of TimeSlot objects, or error
 *
 * @example
 * const result = await getAvailableSlots(
 *   'user_abc123',
 *   '2024-01-15',
 *   60,
 *   'America/New_York',
 *   'America/Los_Angeles'
 * );
 * if (result.success) {
 *   result.data.forEach(slot => {
 *     console.log(slot.displayTime); // "9:00 AM", "9:30 AM", etc.
 *   });
 * }
 */
export async function getAvailableSlots(
  coachId: string,
  dateStr: string,
  sessionDuration: number,
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

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a Date object as a localized time string in a specific timezone.
 *
 * @param date - The Date object to format
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns Formatted time string (e.g., "2:30 PM")
 *
 * @remarks
 * Falls back to local time formatting if the provided timezone is invalid.
 */
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

/**
 * Gets all bookable dates for a given month.
 *
 * A date is bookable if:
 * 1. It's in the future (with advance notice applied)
 * 2. It's within the coach's max advance booking window
 * 3. Coach has availability on that day of week OR a date-specific override
 *
 * @param coachId - The coach's user ID
 * @param month - Month number (0-indexed: 0 = January, 11 = December)
 * @param year - Full year (e.g., 2024)
 * @returns Success with array of bookable date strings in YYYY-MM-DD format, or error
 *
 * @example
 * // Get bookable dates for January 2024
 * const result = await getBookableDates('user_abc123', 0, 2024);
 * if (result.success) {
 *   console.log(result.data); // ["2024-01-15", "2024-01-16", ...]
 * }
 */
export async function getBookableDates(
  coachId: string,
  month: number,
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
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

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
