import { describe, it, expect } from 'vitest';
import { TIMEZONES, getDetectedTimezone, isValidTimezone } from './timezones';

describe('TIMEZONES', () => {
  it('contains a non-empty array of timezone objects', () => {
    expect(TIMEZONES.length).toBeGreaterThan(0);
  });

  it('each entry has a value and label', () => {
    for (const tz of TIMEZONES) {
      expect(tz.value).toBeTruthy();
      expect(tz.label).toBeTruthy();
    }
  });

  it('includes common timezones like America/New_York and Europe/London', () => {
    const values = TIMEZONES.map((tz) => tz.value);
    expect(values).toContain('America/New_York');
    expect(values).toContain('Europe/London');
    expect(values).toContain('Asia/Tokyo');
    expect(values).toContain('Australia/Sydney');
  });
});

describe('isValidTimezone', () => {
  it('returns true for a timezone in the list', () => {
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('Europe/Paris')).toBe(true);
    expect(isValidTimezone('Asia/Singapore')).toBe(true);
  });

  it('returns false for a timezone not in the list', () => {
    expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone('Invalid')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isValidTimezone('america/new_york')).toBe(false);
    expect(isValidTimezone('EUROPE/LONDON')).toBe(false);
  });
});

describe('getDetectedTimezone', () => {
  it('returns a non-empty string', () => {
    const tz = getDetectedTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });

  it('returns a valid IANA timezone identifier', () => {
    const tz = getDetectedTimezone();
    // IANA timezones follow the pattern Region/City or similar
    expect(tz).toMatch(/^[A-Z][a-zA-Z_]+\/[A-Za-z_]+/);
  });
});
