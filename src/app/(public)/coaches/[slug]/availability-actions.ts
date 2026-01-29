'use server';

import { db, coachProfiles, coachAvailability, bookings, availabilityOverrides } from '@/db';
import { eq, and, gte, lte, or } from 'drizzle-orm';

export interface AvailabilityDisplayData {
  timezone: string | null;
  nextAvailable: string | null; // ISO string or null if no availability
  nextAvailableDisplay: string | null; // Human-readable format
  weeklyAvailabilitySummary: string | null; // e.g., "Mon-Fri, 9am-5pm"
  hasAvailability: boolean;
}

interface DayAvailabilityInfo {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

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

    // Build availability map
    const availabilityMap = new Map<number, DayAvailabilityInfo>();
    for (const avail of weeklyAvail) {
      availabilityMap.set(avail.dayOfWeek, {
        dayOfWeek: avail.dayOfWeek,
        startTime: avail.startTime.substring(0, 5),
        endTime: avail.endTime.substring(0, 5),
        isAvailable: avail.isAvailable,
      });
    }

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
  const minStartTime = new Date(now.getTime() + profile.advanceNoticeHours * 60 * 60 * 1000);
  const maxDate = new Date(now.getTime() + profile.maxAdvanceDays * 24 * 60 * 60 * 1000);

  // Check up to maxAdvanceDays to find next available slot
  const maxDaysToCheck = Math.min(profile.maxAdvanceDays, 60);

  for (let dayOffset = 0; dayOffset < maxDaysToCheck; dayOffset++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate > maxDate) break;

    const dayOfWeek = checkDate.getDay();
    const dateStr = formatDateStr(checkDate);

    // Check for override first
    const overrides = await db
      .select()
      .from(availabilityOverrides)
      .where(
        and(eq(availabilityOverrides.coachId, coachId), eq(availabilityOverrides.date, dateStr))
      )
      .limit(1);

    let dayStartTime: string | null = null;
    let dayEndTime: string | null = null;

    if (overrides.length > 0) {
      const override = overrides[0];
      if (!override.isAvailable) continue;
      dayStartTime = override.startTime?.substring(0, 5) || null;
      dayEndTime = override.endTime?.substring(0, 5) || null;
    } else {
      const dayAvail = availabilityMap.get(dayOfWeek);
      if (!dayAvail || !dayAvail.isAvailable) continue;
      dayStartTime = dayAvail.startTime;
      dayEndTime = dayAvail.endTime;
    }

    if (!dayStartTime || !dayEndTime) continue;

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

    // Find first available slot
    const [startHour, startMin] = dayStartTime.split(':').map(Number);
    const [endHour, endMin] = dayEndTime.split(':').map(Number);

    const slotStartBase = new Date(checkDate);
    slotStartBase.setHours(startHour, startMin, 0, 0);

    const slotEndLimit = new Date(checkDate);
    slotEndLimit.setHours(endHour, endMin, 0, 0);

    let currentSlot = new Date(slotStartBase);

    while (currentSlot.getTime() + sessionDuration * 60 * 1000 <= slotEndLimit.getTime()) {
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
          return slotWithBuffer.start < bookingEnd && slotWithBuffer.end > bookingStart;
        });

        if (!hasConflict) {
          // Found available slot
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

  return null;
}

// Format the next available slot for display
function formatNextAvailableDisplay(slotDate: Date, now: Date, timezone: string): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const slotDay = new Date(slotDate);
  slotDay.setHours(0, 0, 0, 0);

  // Format time
  const timeStr = slotDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });

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
      const dateStr = slotDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: timezone,
      });
      return `${dateStr} at ${timeStr}`;
    }
  }
}

// Generate a human-readable weekly availability summary
function generateWeeklyAvailabilitySummary(
  availabilityMap: Map<number, DayAvailabilityInfo>
): string | null {
  const availableDays: { day: number; start: string; end: string }[] = [];

  for (let i = 0; i < 7; i++) {
    const avail = availabilityMap.get(i);
    if (avail && avail.isAvailable) {
      availableDays.push({
        day: i,
        start: avail.startTime,
        end: avail.endTime,
      });
    }
  }

  if (availableDays.length === 0) {
    return null;
  }

  // Group consecutive days with same times
  const groups: { days: number[]; start: string; end: string }[] = [];

  for (const avail of availableDays) {
    const lastGroup = groups[groups.length - 1];
    if (
      lastGroup &&
      lastGroup.start === avail.start &&
      lastGroup.end === avail.end &&
      avail.day === lastGroup.days[lastGroup.days.length - 1] + 1
    ) {
      lastGroup.days.push(avail.day);
    } else {
      groups.push({ days: [avail.day], start: avail.start, end: avail.end });
    }
  }

  // Format groups
  const parts = groups.map((group) => {
    const daysStr =
      group.days.length === 1
        ? DAY_NAMES[group.days[0]]
        : `${DAY_NAMES[group.days[0]]}-${DAY_NAMES[group.days[group.days.length - 1]]}`;

    const startFormatted = formatTimeShort(group.start);
    const endFormatted = formatTimeShort(group.end);

    return `${daysStr}, ${startFormatted}-${endFormatted}`;
  });

  return parts.join(' | ');
}

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

// Format date to YYYY-MM-DD
function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
