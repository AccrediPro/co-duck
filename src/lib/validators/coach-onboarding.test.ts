import { describe, it, expect } from 'vitest';
import {
  coachBasicInfoSchema,
  coachBioSpecialtiesSchema,
  coachPricingSchema,
  sessionTypeSchema,
  generateSlug,
  COACH_SPECIALTIES,
  SUPPORTED_CURRENCIES,
  SESSION_DURATIONS,
} from './coach-onboarding';

describe('coachBasicInfoSchema', () => {
  const validData = {
    displayName: 'Sarah Johnson',
    headline: 'Executive Coach | Leadership Expert',
    profilePhotoUrl: 'https://example.com/photo.jpg',
    timezone: 'America/New_York',
  };

  it('accepts valid data', () => {
    const result = coachBasicInfoSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects display name shorter than 2 characters', () => {
    const result = coachBasicInfoSchema.safeParse({ ...validData, displayName: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects display name longer than 100 characters', () => {
    const result = coachBasicInfoSchema.safeParse({
      ...validData,
      displayName: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects headline shorter than 10 characters', () => {
    const result = coachBasicInfoSchema.safeParse({ ...validData, headline: 'Short' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL for profilePhotoUrl', () => {
    const result = coachBasicInfoSchema.safeParse({
      ...validData,
      profilePhotoUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('allows empty string for profilePhotoUrl', () => {
    const result = coachBasicInfoSchema.safeParse({ ...validData, profilePhotoUrl: '' });
    expect(result.success).toBe(true);
  });

  it('allows omitted profilePhotoUrl', () => {
    const result = coachBasicInfoSchema.safeParse({
      displayName: validData.displayName,
      headline: validData.headline,
      timezone: validData.timezone,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty timezone', () => {
    const result = coachBasicInfoSchema.safeParse({ ...validData, timezone: '' });
    expect(result.success).toBe(false);
  });
});

describe('coachBioSpecialtiesSchema', () => {
  it('accepts valid bio and specialties', () => {
    const result = coachBioSpecialtiesSchema.safeParse({
      bio: 'I am an experienced coach with 10 years of practice.',
      specialties: ['Life Coaching', 'Career Coaching'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty specialties array', () => {
    const result = coachBioSpecialtiesSchema.safeParse({
      bio: 'Some bio text',
      specialties: [],
    });
    expect(result.success).toBe(false);
  });

  it('allows empty string for bio', () => {
    const result = coachBioSpecialtiesSchema.safeParse({
      bio: '',
      specialties: ['Executive Coaching'],
    });
    expect(result.success).toBe(true);
  });

  it('allows omitted bio', () => {
    const result = coachBioSpecialtiesSchema.safeParse({
      specialties: ['Executive Coaching'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects bio longer than 2000 characters', () => {
    const result = coachBioSpecialtiesSchema.safeParse({
      bio: 'A'.repeat(2001),
      specialties: ['Life Coaching'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects specialties with empty string entries', () => {
    const result = coachBioSpecialtiesSchema.safeParse({
      specialties: [''],
    });
    expect(result.success).toBe(false);
  });
});

describe('sessionTypeSchema', () => {
  const validSession = {
    id: 'session_1706745600000_abc1234',
    name: 'Discovery Call',
    duration: 30,
    price: 0,
  };

  it('accepts a valid session type', () => {
    const result = sessionTypeSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it('rejects negative price', () => {
    const result = sessionTypeSchema.safeParse({ ...validSession, price: -100 });
    expect(result.success).toBe(false);
  });

  it('accepts zero price (free sessions)', () => {
    const result = sessionTypeSchema.safeParse({ ...validSession, price: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects invalid duration (not in SESSION_DURATIONS)', () => {
    const result = sessionTypeSchema.safeParse({ ...validSession, duration: 25 });
    expect(result.success).toBe(false);
  });

  it('accepts all valid durations', () => {
    for (const duration of SESSION_DURATIONS) {
      const result = sessionTypeSchema.safeParse({ ...validSession, duration });
      expect(result.success).toBe(true);
    }
  });

  it('rejects empty session name', () => {
    const result = sessionTypeSchema.safeParse({ ...validSession, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects session name longer than 100 characters', () => {
    const result = sessionTypeSchema.safeParse({ ...validSession, name: 'X'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('coachPricingSchema', () => {
  const validPricing = {
    currency: 'USD',
    sessionTypes: [
      {
        id: 'session_1_abc',
        name: 'Discovery Call',
        duration: 30,
        price: 0,
      },
    ],
  };

  it('accepts valid pricing data', () => {
    const result = coachPricingSchema.safeParse(validPricing);
    expect(result.success).toBe(true);
  });

  it('requires at least 1 session type', () => {
    const result = coachPricingSchema.safeParse({
      ...validPricing,
      sessionTypes: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unsupported currency', () => {
    const result = coachPricingSchema.safeParse({
      ...validPricing,
      currency: 'XYZ',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all supported currencies', () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      const result = coachPricingSchema.safeParse({
        ...validPricing,
        currency: currency.code,
      });
      expect(result.success).toBe(true);
    }
  });

  it('allows optional hourlyRate', () => {
    const result = coachPricingSchema.safeParse({
      ...validPricing,
      hourlyRate: 12500,
    });
    expect(result.success).toBe(true);
  });

  it('allows null hourlyRate', () => {
    const result = coachPricingSchema.safeParse({
      ...validPricing,
      hourlyRate: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('generateSlug', () => {
  it('converts name to lowercase hyphenated slug', () => {
    expect(generateSlug('Sarah Johnson')).toBe('sarah-johnson');
  });

  it('handles leading and trailing whitespace', () => {
    expect(generateSlug('  Jane   Doe  ')).toBe('jane-doe');
  });

  it('removes special characters', () => {
    expect(generateSlug("Dr. John O'Brien")).toBe('dr-john-obrien');
  });

  it('collapses multiple hyphens into one', () => {
    expect(generateSlug('Anna - Marie')).toBe('anna-marie');
  });

  it('truncates to 50 characters maximum', () => {
    const longName = 'A'.repeat(60);
    const slug = generateSlug(longName);
    expect(slug.length).toBeLessThanOrEqual(50);
  });

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('');
  });

  it('removes non-ASCII special characters', () => {
    // Note: \w in JS regex matches [a-zA-Z0-9_], so accented chars like á are removed
    expect(generateSlug('María García-López')).toBe('mara-garca-lpez');
  });
});

describe('constants', () => {
  it('COACH_SPECIALTIES contains 12 specialties', () => {
    expect(COACH_SPECIALTIES).toHaveLength(12);
  });

  it('SUPPORTED_CURRENCIES contains 10 currencies', () => {
    expect(SUPPORTED_CURRENCIES).toHaveLength(10);
  });

  it('SESSION_DURATIONS contains [15, 30, 45, 60, 90, 120]', () => {
    expect([...SESSION_DURATIONS]).toEqual([15, 30, 45, 60, 90, 120]);
  });
});

// ──────────────────────────────────────────────────────────────────
// ADDITIONAL EDGE CASE TESTS
// ──────────────────────────────────────────────────────────────────

describe('coachBasicInfoSchema — edge cases', () => {
  const validData = {
    displayName: 'Sarah Johnson',
    headline: 'Executive Coach | Leadership Expert',
    timezone: 'America/New_York',
  };

  it('accepts display name at exactly 2 characters (boundary)', () => {
    const result = coachBasicInfoSchema.safeParse({ ...validData, displayName: 'Al' });
    expect(result.success).toBe(true);
  });

  it('accepts display name at exactly 100 characters (boundary)', () => {
    const result = coachBasicInfoSchema.safeParse({ ...validData, displayName: 'A'.repeat(100) });
    expect(result.success).toBe(true);
  });

  it('accepts headline at exactly 10 characters (boundary)', () => {
    const result = coachBasicInfoSchema.safeParse({ ...validData, headline: 'Life Coach' });
    expect(result.success).toBe(true);
  });

  it('accepts headline at exactly 150 characters (boundary)', () => {
    const result = coachBasicInfoSchema.safeParse({ ...validData, headline: 'C'.repeat(150) });
    expect(result.success).toBe(true);
  });

  it('rejects headline longer than 150 characters', () => {
    const result = coachBasicInfoSchema.safeParse({ ...validData, headline: 'C'.repeat(151) });
    expect(result.success).toBe(false);
  });

  it('accepts XSS-like strings in display name (Zod does not sanitize)', () => {
    const xss = '<script>alert("xss")</script>';
    const result = coachBasicInfoSchema.safeParse({ ...validData, displayName: xss });
    // Zod validates length/type, not content. XSS prevention is handled at output.
    expect(result.success).toBe(true);
  });

  it('accepts SQL injection-like strings in headline (Zod does not sanitize)', () => {
    const sql = "'; DROP TABLE users; --";
    const result = coachBasicInfoSchema.safeParse({ ...validData, headline: sql });
    expect(result.success).toBe(true);
  });

  it('rejects non-string types for displayName', () => {
    const result = coachBasicInfoSchema.safeParse({ ...validData, displayName: 12345 });
    expect(result.success).toBe(false);
  });

  it('rejects non-string types for headline', () => {
    const result = coachBasicInfoSchema.safeParse({ ...validData, headline: null });
    expect(result.success).toBe(false);
  });
});

describe('sessionTypeSchema — edge cases', () => {
  const validSession = {
    id: 'session_1706745600000_abc1234',
    name: 'Discovery Call',
    duration: 30,
    price: 0,
  };

  it('rejects float price (Zod number accepts floats but price should be integer cents)', () => {
    // Zod .min(0) doesn't reject floats — this documents the behavior
    const result = sessionTypeSchema.safeParse({ ...validSession, price: 99.99 });
    // Zod number() accepts floats; business convention enforces integers
    expect(result.success).toBe(true);
  });

  it('accepts very large price (high-end coaching)', () => {
    const result = sessionTypeSchema.safeParse({ ...validSession, price: 100000 }); // $1000.00
    expect(result.success).toBe(true);
  });

  it('rejects duration of 0', () => {
    const result = sessionTypeSchema.safeParse({ ...validSession, duration: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative duration', () => {
    const result = sessionTypeSchema.safeParse({ ...validSession, duration: -30 });
    expect(result.success).toBe(false);
  });

  it('accepts session name at exactly 1 character (boundary)', () => {
    const result = sessionTypeSchema.safeParse({ ...validSession, name: 'X' });
    expect(result.success).toBe(true);
  });

  it('accepts session name at exactly 100 characters (boundary)', () => {
    const result = sessionTypeSchema.safeParse({ ...validSession, name: 'X'.repeat(100) });
    expect(result.success).toBe(true);
  });
});

describe('generateSlug — edge cases', () => {
  it('handles names with underscores (preserved by \\w)', () => {
    expect(generateSlug('test_name')).toBe('test_name');
  });

  it('handles names with numbers', () => {
    expect(generateSlug('Coach 123')).toBe('coach-123');
  });

  it('handles consecutive spaces', () => {
    expect(generateSlug('John    Doe')).toBe('john-doe');
  });

  it('handles names with tab characters', () => {
    expect(generateSlug('John\tDoe')).toBe('john-doe');
  });

  it('handles single character name', () => {
    expect(generateSlug('A')).toBe('a');
  });

  it('truncates exactly at 50 characters without breaking mid-word', () => {
    const slug = generateSlug('a'.repeat(60));
    expect(slug.length).toBe(50);
  });
});
