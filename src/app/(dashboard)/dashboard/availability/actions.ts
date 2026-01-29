'use server';

import { auth } from '@clerk/nextjs/server';
import { db, coachProfiles, coachAvailability } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Day schedule schema
const dayScheduleSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  isAvailable: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
});

// Full availability settings schema
const availabilitySettingsSchema = z.object({
  schedule: z.array(dayScheduleSchema).length(7, 'Schedule must have 7 days'),
  bufferMinutes: z.number().min(0).max(120),
  advanceNoticeHours: z.number().min(0).max(168), // Max 1 week
  maxAdvanceDays: z.number().min(1).max(365),
});

export type DaySchedule = z.infer<typeof dayScheduleSchema>;
export type AvailabilitySettings = z.infer<typeof availabilitySettingsSchema>;

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

// Copy schedule from one day to others
export type CopyScheduleData = {
  sourceDay: number;
  targetDays: number[];
  schedule: DaySchedule[];
};

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
