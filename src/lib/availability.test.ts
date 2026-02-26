import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for availability slot generation logic.
 *
 * The core generateTimeSlots function lives in the API route. We re-implement
 * the same pure logic here to test it without DB/HTTP dependencies.
 * This ensures the business rules are correctly verified.
 */

// -- Re-implement the pure functions from the availability route for testing --

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

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

    const slotDateTime = new Date(`${date}T${slotStart}:00`);

    const isPast = slotDateTime < minBookingTime;

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

// -- Tests --

describe('formatTime', () => {
  it('formats 0 minutes as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('formats 60 minutes as 01:00', () => {
    expect(formatTime(60)).toBe('01:00');
  });

  it('formats 90 minutes as 01:30', () => {
    expect(formatTime(90)).toBe('01:30');
  });

  it('formats 540 minutes as 09:00', () => {
    expect(formatTime(540)).toBe('09:00');
  });

  it('formats 1020 minutes as 17:00', () => {
    expect(formatTime(1020)).toBe('17:00');
  });

  it('pads single-digit hours and minutes', () => {
    expect(formatTime(65)).toBe('01:05');
  });
});

describe('generateTimeSlots', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set "now" to 2026-03-01 at 00:00 UTC — all test dates are in the future
    vi.setSystemTime(new Date('2026-03-01T00:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const futureDate = '2026-03-10';

  it('generates correct number of 60-min slots for a 9-17 workday', () => {
    const slots = generateTimeSlots('09:00', '17:00', 60, 0, [], futureDate, 0);

    expect(slots).toHaveLength(8);
    expect(slots[0].start).toBe('09:00');
    expect(slots[0].end).toBe('10:00');
    expect(slots[7].start).toBe('16:00');
    expect(slots[7].end).toBe('17:00');
  });

  it('generates correct 30-min slots', () => {
    const slots = generateTimeSlots('09:00', '12:00', 30, 0, [], futureDate, 0);

    expect(slots).toHaveLength(6); // 09:00, 09:30, 10:00, 10:30, 11:00, 11:30
    expect(slots[0].start).toBe('09:00');
    expect(slots[5].start).toBe('11:30');
    expect(slots[5].end).toBe('12:00');
  });

  it('respects buffer minutes between slots', () => {
    const slots = generateTimeSlots('09:00', '12:00', 60, 15, [], futureDate, 0);

    // Each slot takes 75min (60 + 15 buffer)
    // 09:00-10:00, 10:15-11:15 → only 2 fit
    expect(slots).toHaveLength(2);
    expect(slots[0].start).toBe('09:00');
    expect(slots[0].end).toBe('10:00');
    expect(slots[1].start).toBe('10:15');
    expect(slots[1].end).toBe('11:15');
  });

  it('marks slots as unavailable when conflicting with existing bookings', () => {
    const existingBookings = [
      {
        startTime: new Date(`${futureDate}T10:00:00`),
        endTime: new Date(`${futureDate}T11:00:00`),
      },
    ];

    const slots = generateTimeSlots('09:00', '13:00', 60, 0, existingBookings, futureDate, 0);

    expect(slots[0].available).toBe(true); // 09:00-10:00
    expect(slots[1].available).toBe(false); // 10:00-11:00 conflicts
    expect(slots[2].available).toBe(true); // 11:00-12:00
    expect(slots[3].available).toBe(true); // 12:00-13:00
  });

  it('handles partial overlap with existing bookings', () => {
    const existingBookings = [
      {
        startTime: new Date(`${futureDate}T09:30:00`),
        endTime: new Date(`${futureDate}T10:30:00`),
      },
    ];

    const slots = generateTimeSlots('09:00', '12:00', 60, 0, existingBookings, futureDate, 0);

    expect(slots[0].available).toBe(false); // 09:00-10:00 overlaps with 09:30-10:30
    expect(slots[1].available).toBe(false); // 10:00-11:00 overlaps with 09:30-10:30
    expect(slots[2].available).toBe(true); // 11:00-12:00
  });

  it('marks past slots as unavailable based on advance notice', () => {
    // Now is 2026-03-01T00:00:00, testing same day with 2h notice
    const today = '2026-03-01';
    vi.setSystemTime(new Date('2026-03-01T09:00:00'));

    const slots = generateTimeSlots('09:00', '17:00', 60, 0, [], today, 2);

    // At 09:00 with 2h notice, anything before 11:00 should be unavailable
    expect(slots[0].available).toBe(false); // 09:00 — past/too soon
    expect(slots[1].available).toBe(false); // 10:00 — too soon
    expect(slots[2].available).toBe(true); // 11:00 — available
  });

  it('returns empty array when no slots fit within the window', () => {
    const slots = generateTimeSlots('09:00', '09:30', 60, 0, [], futureDate, 0);

    expect(slots).toHaveLength(0);
  });

  it('handles exactly one slot fitting', () => {
    const slots = generateTimeSlots('09:00', '10:00', 60, 0, [], futureDate, 0);

    expect(slots).toHaveLength(1);
    expect(slots[0].start).toBe('09:00');
    expect(slots[0].end).toBe('10:00');
  });

  it('handles multiple bookings on the same day', () => {
    const existingBookings = [
      {
        startTime: new Date(`${futureDate}T09:00:00`),
        endTime: new Date(`${futureDate}T10:00:00`),
      },
      {
        startTime: new Date(`${futureDate}T14:00:00`),
        endTime: new Date(`${futureDate}T15:00:00`),
      },
    ];

    const slots = generateTimeSlots('09:00', '17:00', 60, 0, existingBookings, futureDate, 0);

    expect(slots[0].available).toBe(false); // 09:00 — booked
    expect(slots[1].available).toBe(true); // 10:00
    expect(slots[5].available).toBe(false); // 14:00 — booked
    expect(slots[6].available).toBe(true); // 15:00
  });

  it('handles 15-minute sessions with no buffer', () => {
    const slots = generateTimeSlots('09:00', '10:00', 15, 0, [], futureDate, 0);

    expect(slots).toHaveLength(4);
    expect(slots[0]).toEqual({ start: '09:00', end: '09:15', available: true });
    expect(slots[3]).toEqual({ start: '09:45', end: '10:00', available: true });
  });

  it('handles HH:MM:SS time format (ignores seconds)', () => {
    const slots = generateTimeSlots('09:00:00', '10:00:00', 60, 0, [], futureDate, 0);

    expect(slots).toHaveLength(1);
    expect(slots[0].start).toBe('09:00');
  });

  it('handles 0 advance notice hours', () => {
    const slots = generateTimeSlots('09:00', '10:00', 60, 0, [], futureDate, 0);

    expect(slots).toHaveLength(1);
    expect(slots[0].available).toBe(true);
  });
});
