/**
 * @fileoverview Public Coach Availability Display Actions
 *
 * This module provides server actions for displaying coach availability
 * information on public coach profile pages. Unlike the dashboard actions
 * (which allow coaches to edit their availability), these are read-only
 * actions optimized for the public-facing coach profile.
 *
 * ## Key Features
 * - Calculate next available booking slot considering all constraints
 * - Generate human-readable availability summary (e.g., "Mon-Fri, 9am-5pm")
 * - Handle availability overrides for specific dates
 * - Account for existing bookings and buffer time
 *
 * ## Usage Context
 * These actions are called from the public coach profile page to show
 * potential clients when the coach is available for booking.
 *
 * ## Availability Calculation
 * The next available slot considers:
 * 1. Weekly schedule (coach_availability table)
 * 2. Date-specific overrides (availability_overrides table)
 * 3. Existing bookings (pending + confirmed)
 * 4. Buffer time between sessions
 * 5. Advance notice requirements
 * 6. Maximum advance booking window
 *
 * @module coaches/[slug]/availability-actions
 */

'use server';

import { db, coachProfiles, coachAvailability, bookings, availabilityOverrides } from '@/db';
import { eq, and, gte, lte, or } from 'drizzle-orm';
import { formatDate, formatTimeInTz } from '@/lib/date-utils';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Availability information displayed on coach public profile.
 *
 * @property timezone - Coach's configured timezone (null if profile not found)
 * @property nextAvailable - ISO timestamp of next available slot (null if none)
 * @property nextAvailableDisplay - Human-readable format like "Tomorrow at 2:00 PM"
 * @property weeklyAvailabilitySummary - Summary like "Mon-Fri, 9am-5pm"
 * @property hasAvailability - Whether coach has any availability configured
 */
export interface AvailabilityDisplayData {
  timezone: string | null;
  nextAvailable: string | null; // ISO string or null if no availability
  nextAvailableDisplay: string | null; // Human-readable format
  weeklyAvailabilitySummary: string | null; // e.g., "Mon-Fri, 9am-5pm"
  hasAvailability: boolean;
}

/**
 * A single time range within a day (e.g., 9am-12pm).
 * @internal
 */
interface TimeRange {
  startTime: string;
  endTime: string;
}

/**
 * Internal type for day availability details.
 * Supports multiple time ranges per day (e.g., 8am-12pm + 3pm-6pm).
 * @internal
 */
interface DayAvailabilityInfo {
  dayOfWeek: number;
  timeRanges: TimeRange[];
  isAvailable: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Short day names for summary display (e.g., "Mon-Fri") */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Full day names for relative date display (e.g., "Wednesday at 2:00 PM") */
const DAY_FULL_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Fetches availability display data for a coach's public profile.
 *
 * This is the main entry point for showing availability on the public
 * coach profile page. It calculates the next available booking slot
 * and generates a human-readable weekly summary.
 *
 * @param coachId - Clerk user ID of the coach
 * @returns Availability display data for the profile
 *
 * @example
 * const availability = await getCoachAvailabilityForProfile(coachId);
 *
 * if (availability.hasAvailability) {
 *   console.log(`Next available: ${availability.nextAvailableDisplay}`);
 *   console.log(`Schedule: ${availability.weeklyAvailabilitySummary}`);
 * } else {
 *   console.log('No availability set');
 * }
 *
 * @remarks
 * - Returns safe defaults (null values, hasAvailability: false) on errors
 * - Calculates next slot using minimum session duration from coach's types
 * - Defaults to 30-minute slots if no session types configured
 * - Checks up to 60 days ahead for next available slot
 */
// Get availability display data for a coach's public profile
export async function getCoachAvailabilityForProfile(
  coachId: string
): Promise<AvailabilityDisplayData> {
  try {
    // Get coach profile settings
    const profiles = await db
      .select({
        timezone: coachProfiles.timezone,
        bufferMinutes: coachProfiles.bufferMinutes,
        advanceNoticeHours: coachProfiles.advanceNoticeHours,
        maxAdvanceDays: coachProfiles.maxAdvanceDays,
        sessionTypes: coachProfiles.sessionTypes,
      })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, coachId))
      .limit(1);

    if (profiles.length === 0) {
      return {
        timezone: null,
        nextAvailable: null,
        nextAvailableDisplay: null,
        weeklyAvailabilitySummary: null,
        hasAvailability: false,
      };
    }

    const profile = profiles[0];
    const timezone = profile.timezone || 'America/New_York';

    // Get weekly availability
    const weeklyAvail = await db
      .select({
        dayOfWeek: coachAvailability.dayOfWeek,
        startTime: coachAvailability.startTime,
        endTime: coachAvailability.endTime,
        isAvailable: coachAvailability.isAvailable,
      })
      .from(coachAvailability)
      .where(eq(coachAvailability.coachId, coachId));

    // Check if coach has any availability set
    const availableDays = weeklyAvail.filter((a) => a.isAvailable);
    if (availableDays.length === 0) {
      return {
        timezone,
        nextAvailable: null,
        nextAvailableDisplay: null,
        weeklyAvailabilitySummary: null,
        hasAvailability: false,
      };
    }

    // Build availability map — group multiple records per dayOfWeek into timeRanges
    const availabilityMap = new Map<number, DayAvailabilityInfo>();
    for (const avail of weeklyAvail) {
      const existing = availabilityMap.get(avail.dayOfWeek);
      if (existing) {
        if (avail.isAvailable) {
          existing.isAvailable = true;
          existing.timeRanges.push({
            startTime: avail.startTime.substring(0, 5),
            endTime: avail.endTime.substring(0, 5),
          });
        }
      } else {
        availabilityMap.set(avail.dayOfWeek, {
          dayOfWeek: avail.dayOfWeek,
          timeRanges: avail.isAvailable
            ? [{ startTime: avail.startTime.substring(0, 5), endTime: avail.endTime.substring(0, 5) }]
            : [],
          isAvailable: avail.isAvailable,
        });
      }
    }
    // Sort ranges within each day by startTime
    Array.from(availabilityMap.values()).forEach((info) => {
      info.timeRanges.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    // Get minimum session duration for slot calculation
    const minDuration =
      profile.sessionTypes && profile.sessionTypes.length > 0
        ? Math.min(...profile.sessionTypes.map((s) => s.duration))
        : 30;

    // Calculate next available slot
    const nextAvailableData = await findNextAvailableSlot(
      coachId,
      profile,
      availabilityMap,
      minDuration,
      timezone
    );

    // Generate weekly availability summary
    const weeklyAvailabilitySummary = generateWeeklyAvailabilitySummary(availabilityMap);

    return {
      timezone,
      nextAvailable: nextAvailableData?.isoString || null,
      nextAvailableDisplay: nextAvailableData?.display || null,
      weeklyAvailabilitySummary,
      hasAvailability: true,
    };
  } catch (error) {
    console.error('Error fetching availability for profile:', error);
    return {
      timezone: null,
      nextAvailable: null,
      nextAvailableDisplay: null,
      weeklyAvailabilitySummary: null,
      hasAvailability: false,
    };
  }
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Finds the next available booking slot for a coach.
 *
 * This function iterates through future dates (up to 60 days or maxAdvanceDays)
 * to find the first time slot that:
 * 1. Falls within the coach's availability window
 * 2. Does not conflict with existing bookings (including buffer)
 * 3. Meets the advance notice requirement
 * 4. Falls within the max advance days window
 *
 * @param coachId - Clerk user ID of the coach
 * @param profile - Coach's booking constraint settings
 * @param availabilityMap - Map of day-of-week to availability info
 * @param sessionDuration - Minimum session duration in minutes
 * @param timezone - Coach's configured timezone
 * @returns Object with ISO string and display format, or null if none found
 *
 * @remarks
 * - Checks availability overrides before falling back to weekly schedule
 * - Uses 30-minute slot increments for searching
 * - Buffer time is applied to both start and end of potential slots
 * - Only considers 'pending' and 'confirmed' bookings as conflicts
 *
 * @internal
 */
// Find the next available time slot for booking
async function findNextAvailableSlot(
  coachId: string,
  profile: {
    bufferMinutes: number;
    advanceNoticeHours: number;
    maxAdvanceDays: number;
  },
  availabilityMap: Map<number, DayAvailabilityInfo>,
  sessionDuration: number,
  timezone: string
): Promise<{ isoString: string; display: string } | null> {
  const now = new Date();

  // Calculate booking window boundaries:
  // - minStartTime: earliest allowed booking (respects advance notice)
  // - maxDate: latest allowed booking (respects max advance days)
  const minStartTime = new Date(now.getTime() + profile.advanceNoticeHours * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() + profile.maxAdvanceDays * 24 * 60 * 60 * 1000);

  // Cap search to 60 days for performance (avoid excessive DB queries)
  const maxDaysToCheck = Math.min(profile.maxAdvanceDays, 60);

  for (let dayOffset = 0; dayOffset < maxDaysToCheck; dayOffset++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate > maxDate) break;

    const dayOfWeek = checkDate.getDay();
    const dateStr = formatDateStr(checkDate);

    // OVERRIDE PRIORITY: Check for date-specific override before using weekly schedule.
    // Overrides allow coaches to block specific dates (vacation) or set custom hours.
    const overrides = await db
      .select()
      .from(availabilityOverrides)
      .where(
        and(eq(availabilityOverrides.coachId, coachId), eq(availabilityOverrides.date, dateStr))
      )
      .limit(1);

    // Build time ranges for this day
    let dayRanges: TimeRange[] = [];

    if (overrides.length > 0) {
      // Override found - use its settings instead of weekly schedule (single range)
      const override = overrides[0];
      if (!override.isAvailable) continue; // Coach blocked this date entirely
      const start = override.startTime?.substring(0, 5);
      const end = override.endTime?.substring(0, 5);
      if (start && end) {
        dayRanges = [{ startTime: start, endTime: end }];
      }
    } else {
      // No override - fall back to weekly recurring schedule (may have multiple ranges)
      const dayAvail = availabilityMap.get(dayOfWeek);
      if (!dayAvail || !dayAvail.isAvailable || dayAvail.timeRanges.length === 0) continue;
      dayRanges = dayAvail.timeRanges;
    }

    if (dayRanges.length === 0) continue;

    // Get existing bookings for this date
    const startOfDay = new Date(checkDate);
    const endOfDay = new Date(checkDate);
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

    // Search all ranges for the first available slot
    for (const range of dayRanges) {
      const [startHour, startMin] = range.startTime.split(':').map(Number);
      const [endHour, endMin] = range.endTime.split(':').map(Number);

      const slotStartBase = new Date(checkDate);
      slotStartBase.setHours(startHour, startMin, 0, 0);

      const slotEndLimit = new Date(checkDate);
      slotEndLimit.setHours(endHour, endMin, 0, 0);

      let currentSlot = new Date(slotStartBase);

      while (currentSlot.getTime() + sessionDuration * 60 * 1000 <= slotEndLimit.getTime()) {
        const slotEndTime = new Date(currentSlot.getTime() + sessionDuration * 60 * 1000);

        // Only consider slots that meet the advance notice requirement
        if (currentSlot >= minStartTime) {
          const slotWithBuffer = {
            start: new Date(currentSlot.getTime() - profile.bufferMinutes * 60 * 1000),
            end: new Date(slotEndTime.getTime() + profile.bufferMinutes * 60 * 1000),
          };

          const hasConflict = existingBookings.some((booking) => {
            const bookingStart = new Date(booking.startTime);
            const bookingEnd = new Date(booking.endTime);
            return slotWithBuffer.start < bookingEnd && slotWithBuffer.end > bookingStart;
          });

          if (!hasConflict) {
            const display = formatNextAvailableDisplay(currentSlot, now, timezone);
            return {
              isoString: currentSlot.toISOString(),
              display,
            };
          }
        }

        // Move to next slot (30 minute increments)
        currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000);
      }
    }
  }

  return null;
}

/**
 * Formats a slot date for human-readable display.
 *
 * Output format depends on how far away the slot is:
 * - Same day: "Today at 2:00 PM"
 * - Next day: "Tomorrow at 9:00 AM"
 * - Within a week: "Wednesday at 10:30 AM"
 * - Beyond a week: "Jan 15 at 3:00 PM"
 *
 * @param slotDate - The date/time of the available slot
 * @param now - Current date/time for comparison
 * @param timezone - Timezone for formatting the time
 * @returns Human-readable string describing when the slot is
 *
 * @internal
 */
// Format the next available slot for display
function formatNextAvailableDisplay(slotDate: Date, now: Date, timezone: string): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const slotDay = new Date(slotDate);
  slotDay.setHours(0, 0, 0, 0);

  const timeStr = formatTimeInTz(slotDate, timezone);

  if (slotDay.getTime() === today.getTime()) {
    return `Today at ${timeStr}`;
  } else if (slotDay.getTime() === tomorrow.getTime()) {
    return `Tomorrow at ${timeStr}`;
  } else {
    const daysDiff = Math.ceil((slotDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 7) {
      const dayName = DAY_FULL_NAMES[slotDate.getDay()];
      return `${dayName} at ${timeStr}`;
    } else {
      const dateStr = formatDate(slotDate);
      return `${dateStr} at ${timeStr}`;
    }
  }
}

/**
 * Generates a human-readable weekly availability summary.
 *
 * Creates a compact string showing when the coach is available,
 * grouping consecutive days with the same schedule.
 *
 * @param availabilityMap - Map of day-of-week to availability info
 * @returns Summary string like "Mon-Fri, 9am-5pm | Sat, 10am-2pm", or null if no availability
 *
 * @example
 * // If coach is available Mon-Fri 9-5 and Sat 10-2:
 * // Returns: "Mon-Fri, 9am-5pm | Sat, 10am-2pm"
 *
 * // If coach only available Tuesday and Thursday 1-6:
 * // Returns: "Tue, 1pm-6pm | Thu, 1pm-6pm"
 *
 * @remarks
 * - Groups consecutive days with identical times (same start/end)
 * - Uses abbreviated day names (Mon, Tue, etc.)
 * - Uses compact time format (9am, 5pm, 10:30am)
 * - Separates groups with " | "
 *
 * @internal
 */
// Generate a human-readable weekly availability summary
// Supports multiple time ranges per day:
//   Single range:    "Mon-Fri, 9am-5pm"
//   Multiple ranges: "Mon-Fri, 9am-12pm & 2pm-6pm"
//   Mixed:           "Mon-Wed, 9am-12pm & 2pm-6pm | Thu-Fri, 9am-5pm"
function generateWeeklyAvailabilitySummary(
  availabilityMap: Map<number, DayAvailabilityInfo>
): string | null {
  // Build list of available days with their range signatures
  const availableDays: { day: number; ranges: TimeRange[] }[] = [];

  for (let i = 0; i < 7; i++) {
    const avail = availabilityMap.get(i);
    if (avail && avail.isAvailable && avail.timeRanges.length > 0) {
      availableDays.push({ day: i, ranges: avail.timeRanges });
    }
  }

  if (availableDays.length === 0) {
    return null;
  }

  // Create a signature string for each day's ranges to enable grouping
  const rangeSignature = (ranges: TimeRange[]): string =>
    ranges.map((r) => `${r.startTime}-${r.endTime}`).join(',');

  // Group consecutive days with identical range sets
  const groups: { days: number[]; ranges: TimeRange[] }[] = [];

  for (const avail of availableDays) {
    const lastGroup = groups[groups.length - 1];
    if (
      lastGroup &&
      rangeSignature(lastGroup.ranges) === rangeSignature(avail.ranges) &&
      avail.day === lastGroup.days[lastGroup.days.length - 1] + 1
    ) {
      lastGroup.days.push(avail.day);
    } else {
      groups.push({ days: [avail.day], ranges: avail.ranges });
    }
  }

  // Format groups
  const parts = groups.map((group) => {
    const daysStr =
      group.days.length === 1
        ? DAY_NAMES[group.days[0]]
        : `${DAY_NAMES[group.days[0]]}-${DAY_NAMES[group.days[group.days.length - 1]]}`;

    const rangesStr = group.ranges
      .map((r) => `${formatTimeShort(r.startTime)}-${formatTimeShort(r.endTime)}`)
      .join(' & ');

    return `${daysStr}, ${rangesStr}`;
  });

  return parts.join(' | ');
}

/**
 * Formats a time string in compact 12-hour format.
 *
 * @param time - Time in HH:MM format (24-hour)
 * @returns Compact time string like "9am", "5pm", or "10:30am"
 *
 * @example
 * formatTimeShort("09:00") // "9am"
 * formatTimeShort("17:00") // "5pm"
 * formatTimeShort("10:30") // "10:30am"
 * formatTimeShort("12:00") // "12pm"
 *
 * @internal
 */
// Format time for summary (e.g., "9am", "5pm", "10:30am")
function formatTimeShort(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const period = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour % 12 || 12;

  if (minute === 0) {
    return `${hour12}${period}`;
  }
  return `${hour12}:${minute.toString().padStart(2, '0')}${period}`;
}

/**
 * Formats a Date object to YYYY-MM-DD string for database queries.
 *
 * @param date - Date to format
 * @returns Date string in YYYY-MM-DD format
 *
 * @example
 * formatDateStr(new Date('2024-03-15')) // "2024-03-15"
 *
 * @remarks
 * Uses local date components, not UTC, to match database storage format.
 *
 * @internal
 */
// Format date to YYYY-MM-DD
function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
