'use server';

import { auth } from '@clerk/nextjs/server';
import { db, coachProfiles, coachAvailability } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// --- Types ---

export type TimeRange = {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
};

export type DaySchedule = {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  isAvailable: boolean;
  timeRanges: TimeRange[];
};

export type AvailabilitySettings = {
  schedule: DaySchedule[];
  bufferMinutes: number;
  advanceNoticeHours: number;
  maxAdvanceDays: number;
};

// --- Validation helpers ---

function hasOverlappingRanges(ranges: TimeRange[]): boolean {
  if (ranges.length < 2) return false;
  const sorted = [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startTime < sorted[i - 1].endTime) return true;
  }
  return false;
}

// --- Zod schemas ---

const timeRangeSchema = z
  .object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  })
  .refine((r) => r.endTime > r.startTime, {
    message: 'End time must be after start time',
  });

const dayScheduleSchema = z
  .object({
    dayOfWeek: z.number().min(0).max(6),
    isAvailable: z.boolean(),
    timeRanges: z.array(timeRangeSchema),
  })
  .refine((day) => !day.isAvailable || day.timeRanges.length >= 1, {
    message: 'Available days must have at least one time range',
  })
  .refine((day) => !hasOverlappingRanges(day.timeRanges), {
    message: 'Time ranges must not overlap',
  });

const availabilitySettingsSchema = z.object({
  schedule: z.array(dayScheduleSchema).length(7, 'Schedule must have 7 days'),
  bufferMinutes: z.number().min(0).max(120),
  advanceNoticeHours: z.number().min(0).max(168), // Max 1 week
  maxAdvanceDays: z.number().min(1).max(365),
});

// --- Server actions ---

export type SaveAvailabilityResult = { success: true } | { success: false; error: string };

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

    // Insert new availability records — one row per time range
    for (const day of data.schedule) {
      if (day.isAvailable && day.timeRanges.length > 0) {
        for (const range of day.timeRanges) {
          await db.insert(coachAvailability).values({
            coachId: userId,
            dayOfWeek: day.dayOfWeek,
            isAvailable: true,
            startTime: range.startTime + ':00',
            endTime: range.endTime + ':00',
          });
        }
      } else {
        // Preserve disabled state with a default row
        await db.insert(coachAvailability).values({
          coachId: userId,
          dayOfWeek: day.dayOfWeek,
          isAvailable: false,
          startTime: '09:00:00',
          endTime: '17:00:00',
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving availability:', error);
    return { success: false, error: 'An error occurred while saving your availability' };
  }
}

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

    // Build schedule array — group records by dayOfWeek
    const schedule: DaySchedule[] = [];
    for (let i = 0; i < 7; i++) {
      const dayRecords = availabilityRecords.filter((r) => r.dayOfWeek === i);
      const availableRecords = dayRecords.filter((r) => r.isAvailable);

      if (availableRecords.length > 0) {
        const timeRanges: TimeRange[] = availableRecords
          .map((r) => ({
            startTime: r.startTime.substring(0, 5),
            endTime: r.endTime.substring(0, 5),
          }))
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

        schedule.push({ dayOfWeek: i, isAvailable: true, timeRanges });
      } else {
        // No records or only isAvailable=false records — default unavailable
        schedule.push({
          dayOfWeek: i,
          isAvailable: false,
          timeRanges: [{ startTime: '09:00', endTime: '17:00' }],
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
