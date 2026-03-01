import { format } from 'date-fns';

type DateInput = Date | string | number | null | undefined;

function toDate(d: DateInput): Date | null {
  if (d == null) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
}

export function formatDate(d: DateInput): string {
  const date = toDate(d);
  return date ? format(date, 'MM-dd-yyyy') : '';
}

export function formatDateTime(d: DateInput): string {
  const date = toDate(d);
  return date ? format(date, 'MM-dd-yyyy h:mm a') : '';
}

export function formatDateLong(d: DateInput): string {
  const date = toDate(d);
  return date ? format(date, 'EEEE, MM-dd-yyyy') : '';
}

export function formatDateShort(d: DateInput): string {
  const date = toDate(d);
  return date ? format(date, 'MM-dd') : '';
}

export function formatMonthYear(d: DateInput): string {
  const date = toDate(d);
  return date ? format(date, 'MMMM yyyy') : '';
}

export function formatTime(d: DateInput): string {
  const date = toDate(d);
  return date ? format(date, 'h:mm a') : '';
}

export function formatDateWithTime(d: DateInput): string {
  const date = toDate(d);
  return date ? format(date, "EEEE, MM-dd-yyyy 'at' h:mm a") : '';
}

export function formatWeekday(d: DateInput): string {
  const date = toDate(d);
  return date ? format(date, 'EEEE') : '';
}

export function formatTimeInTz(d: DateInput, timezone: string): string {
  const date = toDate(d);
  if (!date) return '';
  try {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });
  } catch {
    return format(date, 'h:mm a');
  }
}
