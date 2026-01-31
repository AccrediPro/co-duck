/**
 * @fileoverview Coach Availability Settings Server Actions
 *
 * This module provides server actions for coaches to manage their weekly
 * availability schedule. Coaches use these actions through the dashboard
 * availability settings page.
 *
 * ## Features
 * - Save weekly availability schedule (7 days)
 * - Configure buffer time between sessions
 * - Set advance notice requirements
 * - Set maximum advance booking days
 * - Copy schedule from one day to others
 *
 * ## Data Flow
 * 1. Coach accesses /dashboard/availability
 * 2. Frontend loads current settings via `getAvailabilitySettings()`
 * 3. Coach modifies schedule in the UI
 * 4. Changes saved via `saveAvailabilitySettings()`
 *
 * ## Storage
 * - Schedule stored in `coach_availability` table (one row per day)
 * - Buffer/notice/max days stored in `coach_profiles` table
 *
 * @module dashboard/availability/actions
 */

'use server';

import { auth } from '@clerk/nextjs/server';
import { db, coachProfiles, coachAvailability } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Validation schema for a single day's schedule.
 *
 * @remarks
 * - dayOfWeek uses JavaScript convention: 0 = Sunday, 6 = Saturday
 * - Time format is HH:MM (24-hour format)
 * - isAvailable toggles whether the coach accepts bookings on this day
 */
// Day schedule schema
const dayScheduleSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  isAvailable: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
});

/**
 * Validation schema for complete availability settings.
 *
 * @remarks
 * - Schedule must contain exactly 7 days (Sunday through Saturday)
 * - bufferMinutes: Gap between sessions (0-120 minutes)
 * - advanceNoticeHours: Minimum hours before a booking can start (0-168, max 1 week)
 * - maxAdvanceDays: How far in advance clients can book (1-365 days)
 */
// Full availability settings schema
const availabilitySettingsSchema = z.object({
  schedule: z.array(dayScheduleSchema).length(7, 'Schedule must have 7 days'),
  bufferMinutes: z.number().min(0).max(120),
  advanceNoticeHours: z.number().min(0).max(168), // Max 1 week
  maxAdvanceDays: z.number().min(1).max(365),
});

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Schedule configuration for a single day of the week.
 *
 * @property dayOfWeek - Day index (0 = Sunday, 6 = Saturday)
 * @property isAvailable - Whether the coach is available this day
 * @property startTime - Day's start time in HH:MM format (24-hour)
 * @property endTime - Day's end time in HH:MM format (24-hour)
 */
export type DaySchedule = z.infer<typeof dayScheduleSchema>;

/**
 * Complete availability settings for a coach.
 *
 * @property schedule - Array of 7 DaySchedule objects (Sun-Sat)
 * @property bufferMinutes - Minutes between sessions for coach preparation
 * @property advanceNoticeHours - Minimum hours before session can be booked
 * @property maxAdvanceDays - Maximum days in advance a session can be booked
 */
export type AvailabilitySettings = z.infer<typeof availabilitySettingsSchema>;

/**
 * Result type for save operation.
 *
 * @example
 * // Success case
 * { success: true }
 *
 * // Error case
 * { success: false, error: "Coach profile not found" }
 */
export type SaveAvailabilityResult = { success: true } | { success: false; error: string };

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Saves coach availability settings to the database.
 *
 * This action performs a complete replacement of the coach's availability:
 * 1. Validates input data using Zod schema
 * 2. Updates coach profile with buffer/notice/max days settings
 * 3. Deletes all existing availability records
 * 4. Inserts new availability records for all 7 days
 *
 * @param data - Complete availability settings to save
 * @returns Result object indicating success or failure with error message
 *
 * @throws Never throws - all errors are returned as { success: false, error: string }
 *
 * @example
 * const result = await saveAvailabilitySettings({
 *   schedule: [
 *     { dayOfWeek: 0, isAvailable: false, startTime: '09:00', endTime: '17:00' },
 *     { dayOfWeek: 1, isAvailable: true, startTime: '09:00', endTime: '17:00' },
 *     // ... remaining 5 days
 *   ],
 *   bufferMinutes: 15,
 *   advanceNoticeHours: 24,
 *   maxAdvanceDays: 30,
 * });
 *
 * if (!result.success) {
 *   console.error(result.error);
 * }
 *
 * @remarks
 * - Requires authenticated user with coach profile
 * - Time values are stored with seconds appended (HH:MM → HH:MM:00)
 * - All 7 days are always saved, even if isAvailable is false
 */
export async function saveAvailabilitySettings(
  data: AvailabilitySettings
): Promise<SaveAvailabilityResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'You must be logged in to update availability' };
    }

    // Validate input
    const validationResult = availabilitySettingsSchema.safeParse(data);
    if (!validationResult.success) {
      return { success: false, error: validationResult.error.issues[0].message };
    }

    // Check if user has a coach profile
    const profiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return {
        success: false,
        error: 'Coach profile not found. Please complete onboarding first.',
      };
    }

    // Update coach profile settings
    await db
      .update(coachProfiles)
      .set({
        bufferMinutes: data.bufferMinutes,
        advanceNoticeHours: data.advanceNoticeHours,
        maxAdvanceDays: data.maxAdvanceDays,
      })
      .where(eq(coachProfiles.userId, userId));

    // Delete existing availability records
    await db.delete(coachAvailability).where(eq(coachAvailability.coachId, userId));

    // Insert new availability records
    for (const day of data.schedule) {
      await db.insert(coachAvailability).values({
        coachId: userId,
        dayOfWeek: day.dayOfWeek,
        isAvailable: day.isAvailable,
        startTime: day.startTime + ':00', // Add seconds for time column
        endTime: day.endTime + ':00',
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving availability:', error);
    return { success: false, error: 'An error occurred while saving your availability' };
  }
}

/**
 * Result type for fetching availability settings.
 *
 * @property success - Whether the operation succeeded
 * @property data - Availability data (only present when success is true)
 * @property data.schedule - Array of 7 DaySchedule objects
 * @property data.bufferMinutes - Buffer time between sessions
 * @property data.advanceNoticeHours - Minimum notice required
 * @property data.maxAdvanceDays - Maximum advance booking window
 * @property data.timezone - Coach's configured timezone
 * @property error - Error message (only present when success is false)
 */
export type GetAvailabilityResult =
  | {
      success: true;
      data: {
        schedule: DaySchedule[];
        bufferMinutes: number;
        advanceNoticeHours: number;
        maxAdvanceDays: number;
        timezone: string;
      };
    }
  | { success: false; error: string };

/**
 * Retrieves the current availability settings for the authenticated coach.
 *
 * This action fetches the coach's complete availability configuration
 * including their weekly schedule and booking constraints.
 *
 * @returns Result object with availability data or error message
 *
 * @throws Never throws - all errors are returned as { success: false, error: string }
 *
 * @example
 * const result = await getAvailabilitySettings();
 *
 * if (result.success) {
 *   console.log(`Timezone: ${result.data.timezone}`);
 *   console.log(`Buffer: ${result.data.bufferMinutes} minutes`);
 *
 *   result.data.schedule.forEach(day => {
 *     if (day.isAvailable) {
 *       console.log(`Day ${day.dayOfWeek}: ${day.startTime}-${day.endTime}`);
 *     }
 *   });
 * }
 *
 * @remarks
 * - Returns default schedule for days without records in the database
 * - Default times are 09:00-17:00 with isAvailable = false
 * - Time values are returned without seconds (HH:MM:00 → HH:MM)
 * - Default timezone is 'America/New_York' if not configured
 */
export async function getAvailabilitySettings(): Promise<GetAvailabilityResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get coach profile
    const profiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return { success: false, error: 'Coach profile not found' };
    }

    const profile = profiles[0];

    // Get existing availability records
    const availabilityRecords = await db
      .select()
      .from(coachAvailability)
      .where(eq(coachAvailability.coachId, userId));

    // Build schedule array (default to unavailable for days without records)
    const schedule: DaySchedule[] = [];
    for (let i = 0; i < 7; i++) {
      const record = availabilityRecords.find((r) => r.dayOfWeek === i);
      if (record) {
        schedule.push({
          dayOfWeek: record.dayOfWeek,
          isAvailable: record.isAvailable,
          startTime: record.startTime.substring(0, 5), // Remove seconds
          endTime: record.endTime.substring(0, 5),
        });
      } else {
        // Default schedule for days without records
        schedule.push({
          dayOfWeek: i,
          isAvailable: false,
          startTime: '09:00',
          endTime: '17:00',
        });
      }
    }

    return {
      success: true,
      data: {
        schedule,
        bufferMinutes: profile.bufferMinutes,
        advanceNoticeHours: profile.advanceNoticeHours,
        maxAdvanceDays: profile.maxAdvanceDays,
        timezone: profile.timezone || 'America/New_York',
      },
    };
  } catch (error) {
    console.error('Error fetching availability:', error);
    return { success: false, error: 'Failed to load availability settings' };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Input data for copying a day's schedule to other days.
 *
 * @property sourceDay - Day index to copy from (0-6)
 * @property targetDays - Array of day indices to copy to
 * @property schedule - Current schedule array to modify
 */
// Copy schedule from one day to others
export type CopyScheduleData = {
  sourceDay: number;
  targetDays: number[];
  schedule: DaySchedule[];
};

/**
 * Copies availability settings from one day to multiple other days.
 *
 * This is a pure function (no side effects) used by the UI to allow
 * coaches to quickly replicate their schedule across similar days
 * (e.g., copy Monday's schedule to all weekdays).
 *
 * @param data - Copy configuration with source, targets, and current schedule
 * @returns New schedule array with copied values (original array is not modified)
 *
 * @example
 * // Copy Monday (1) schedule to Tuesday-Friday (2-5)
 * const newSchedule = copyDaySchedule({
 *   sourceDay: 1,
 *   targetDays: [2, 3, 4, 5],
 *   schedule: currentSchedule,
 * });
 *
 * @remarks
 * - Copies isAvailable, startTime, and endTime
 * - Returns original schedule if sourceDay is not found
 * - Does not modify the original schedule array
 * - This is a client-side helper, not a server action (no 'use server' needed)
 */
export function copyDaySchedule(data: CopyScheduleData): DaySchedule[] {
  const sourceSchedule = data.schedule.find((d) => d.dayOfWeek === data.sourceDay);
  if (!sourceSchedule) return data.schedule;

  return data.schedule.map((day) => {
    if (data.targetDays.includes(day.dayOfWeek)) {
      return {
        ...day,
        isAvailable: sourceSchedule.isAvailable,
        startTime: sourceSchedule.startTime,
        endTime: sourceSchedule.endTime,
      };
    }
    return day;
  });
}
