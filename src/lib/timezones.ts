// Common timezones grouped by region
export const TIMEZONES = [
  // Americas
  { value: 'America/New_York', label: '(UTC-05:00) Eastern Time - New York' },
  { value: 'America/Chicago', label: '(UTC-06:00) Central Time - Chicago' },
  { value: 'America/Denver', label: '(UTC-07:00) Mountain Time - Denver' },
  { value: 'America/Los_Angeles', label: '(UTC-08:00) Pacific Time - Los Angeles' },
  { value: 'America/Anchorage', label: '(UTC-09:00) Alaska - Anchorage' },
  { value: 'Pacific/Honolulu', label: '(UTC-10:00) Hawaii - Honolulu' },
  { value: 'America/Toronto', label: '(UTC-05:00) Eastern Time - Toronto' },
  { value: 'America/Vancouver', label: '(UTC-08:00) Pacific Time - Vancouver' },
  { value: 'America/Mexico_City', label: '(UTC-06:00) Central Time - Mexico City' },
  { value: 'America/Sao_Paulo', label: '(UTC-03:00) Brasilia Time - Sao Paulo' },
  { value: 'America/Argentina/Buenos_Aires', label: '(UTC-03:00) Argentina - Buenos Aires' },

  // Europe
  { value: 'Europe/London', label: '(UTC+00:00) Greenwich Mean Time - London' },
  { value: 'Europe/Paris', label: '(UTC+01:00) Central European Time - Paris' },
  { value: 'Europe/Berlin', label: '(UTC+01:00) Central European Time - Berlin' },
  { value: 'Europe/Amsterdam', label: '(UTC+01:00) Central European Time - Amsterdam' },
  { value: 'Europe/Rome', label: '(UTC+01:00) Central European Time - Rome' },
  { value: 'Europe/Madrid', label: '(UTC+01:00) Central European Time - Madrid' },
  { value: 'Europe/Zurich', label: '(UTC+01:00) Central European Time - Zurich' },
  { value: 'Europe/Stockholm', label: '(UTC+01:00) Central European Time - Stockholm' },
  { value: 'Europe/Warsaw', label: '(UTC+01:00) Central European Time - Warsaw' },
  { value: 'Europe/Athens', label: '(UTC+02:00) Eastern European Time - Athens' },
  { value: 'Europe/Helsinki', label: '(UTC+02:00) Eastern European Time - Helsinki' },
  { value: 'Europe/Moscow', label: '(UTC+03:00) Moscow Time' },

  // Asia
  { value: 'Asia/Dubai', label: '(UTC+04:00) Gulf Standard Time - Dubai' },
  { value: 'Asia/Kolkata', label: '(UTC+05:30) India Standard Time - Kolkata' },
  { value: 'Asia/Bangkok', label: '(UTC+07:00) Indochina Time - Bangkok' },
  { value: 'Asia/Singapore', label: '(UTC+08:00) Singapore Time' },
  { value: 'Asia/Hong_Kong', label: '(UTC+08:00) Hong Kong Time' },
  { value: 'Asia/Shanghai', label: '(UTC+08:00) China Standard Time - Shanghai' },
  { value: 'Asia/Tokyo', label: '(UTC+09:00) Japan Standard Time - Tokyo' },
  { value: 'Asia/Seoul', label: '(UTC+09:00) Korea Standard Time - Seoul' },

  // Australia & Pacific
  { value: 'Australia/Sydney', label: '(UTC+10:00) Australian Eastern Time - Sydney' },
  { value: 'Australia/Melbourne', label: '(UTC+10:00) Australian Eastern Time - Melbourne' },
  { value: 'Australia/Brisbane', label: '(UTC+10:00) Australian Eastern Time - Brisbane' },
  { value: 'Australia/Perth', label: '(UTC+08:00) Australian Western Time - Perth' },
  { value: 'Pacific/Auckland', label: '(UTC+12:00) New Zealand Time - Auckland' },

  // Africa
  { value: 'Africa/Johannesburg', label: '(UTC+02:00) South Africa Time - Johannesburg' },
  { value: 'Africa/Cairo', label: '(UTC+02:00) Eastern European Time - Cairo' },
  { value: 'Africa/Lagos', label: '(UTC+01:00) West Africa Time - Lagos' },
] as const;

export type TimezoneValue = (typeof TIMEZONES)[number]['value'];

// Get user's detected timezone
export function getDetectedTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/New_York'; // Fallback
  }
}

// Check if a timezone value is in our list
export function isValidTimezone(tz: string): boolean {
  return TIMEZONES.some((t) => t.value === tz);
}
