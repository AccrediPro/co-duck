import { auth } from '@clerk/nextjs/server';
import { db, coachProfiles, coachAvailability, users } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// --- Validation ---

function hasOverlappingRanges(ranges: { startTime: string; endTime: string }[]): boolean {
  if (ranges.length < 2) return false;
  const sorted = [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startTime < sorted[i - 1].endTime) return true;
  }
  return false;
}

const timeRangeSchema = z
  .object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  })
  .refine((r) => r.endTime > r.startTime, { message: 'End time must be after start time' });

const dayScheduleSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isAvailable: z.boolean(),
    timeRanges: z.array(timeRangeSchema),
  })
  .refine((day) => !day.isAvailable || day.timeRanges.length >= 1, {
    message: 'Available days must have at least one time range',
  })
  .refine((day) => !hasOverlappingRanges(day.timeRanges), {
    message: 'Time ranges must not overlap',
  });

const postBodySchema = z.object({
  schedule: z.array(dayScheduleSchema).length(7, 'Schedule must have exactly 7 days'),
  bufferMinutes: z.number().int().min(0).max(120),
  advanceNoticeHours: z.number().int().min(0).max(168),
  maxAdvanceDays: z.number().int().min(1).max(365),
});

// --- GET /api/availability ---

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!currentUser || currentUser.role !== 'coach') {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can access availability settings' },
        },
        { status: 403 }
      );
    }

    const profiles = await db
      .select()
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Coach profile not found' } },
        { status: 404 }
      );
    }

    const profile = profiles[0];

    const availabilityRecords = await db
      .select()
      .from(coachAvailability)
      .where(eq(coachAvailability.coachId, userId));

    // Group records by dayOfWeek into DaySchedule shape
    const schedule = Array.from({ length: 7 }, (_, i) => {
      const dayRecords = availabilityRecords.filter((r) => r.dayOfWeek === i && r.isAvailable);

      if (dayRecords.length > 0) {
        const timeRanges = dayRecords
          .map((r) => ({
            startTime: r.startTime.substring(0, 5),
            endTime: r.endTime.substring(0, 5),
          }))
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        return { dayOfWeek: i, isAvailable: true, timeRanges };
      }

      return {
        dayOfWeek: i,
        isAvailable: false,
        timeRanges: [{ startTime: '09:00', endTime: '17:00' }],
      };
    });

    return Response.json({
      success: true,
      data: {
        schedule,
        bufferMinutes: profile.bufferMinutes,
        advanceNoticeHours: profile.advanceNoticeHours,
        maxAdvanceDays: profile.maxAdvanceDays,
        timezone: profile.timezone || 'America/New_York',
      },
    });
  } catch (error) {
    console.error('GET /api/availability error:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch availability settings' },
      },
      { status: 500 }
    );
  }
}

// --- POST /api/availability ---

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const currentUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!currentUser || currentUser.role !== 'coach') {
      return Response.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only coaches can update availability settings' },
        },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const profiles = await db
      .select({ userId: coachProfiles.userId })
      .from(coachProfiles)
      .where(eq(coachProfiles.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Coach profile not found. Please complete onboarding first.',
          },
        },
        { status: 404 }
      );
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

    // Replace all availability rows atomically
    await db.delete(coachAvailability).where(eq(coachAvailability.coachId, userId));

    const rowsToInsert: Array<typeof coachAvailability.$inferInsert> = [];

    for (const day of data.schedule) {
      if (day.isAvailable && day.timeRanges.length > 0) {
        for (const range of day.timeRanges) {
          rowsToInsert.push({
            coachId: userId,
            dayOfWeek: day.dayOfWeek,
            isAvailable: true,
            startTime: range.startTime + ':00',
            endTime: range.endTime + ':00',
          });
        }
      } else {
        // Preserve disabled state with a sentinel row
        rowsToInsert.push({
          coachId: userId,
          dayOfWeek: day.dayOfWeek,
          isAvailable: false,
          startTime: '09:00:00',
          endTime: '17:00:00',
        });
      }
    }

    await db.insert(coachAvailability).values(rowsToInsert);

    return Response.json({
      success: true,
      data: { message: 'Availability updated' },
    });
  } catch (error) {
    console.error('POST /api/availability error:', error);
    return Response.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to save availability settings' },
      },
      { status: 500 }
    );
  }
}
