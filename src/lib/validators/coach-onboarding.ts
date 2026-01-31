/**
 * @fileoverview Coach Onboarding Validation Schemas
 *
 * This module provides Zod validation schemas for the 4-step coach onboarding wizard.
 * The onboarding flow guides coaches through profile setup before they can be discovered
 * by clients on the platform.
 *
 * ## Onboarding Steps
 *
 * | Step | Form Component         | Schema                    | Purpose                      |
 * |------|------------------------|---------------------------|------------------------------|
 * | 1    | basic-info-form.tsx    | coachBasicInfoSchema      | Name, headline, photo, TZ    |
 * | 2    | bio-specialties-form   | coachBioSpecialtiesSchema | Bio text and specialty tags  |
 * | 3    | pricing-form.tsx       | coachPricingSchema        | Currency and session types   |
 * | 4    | review-publish-form    | N/A (review only)         | Preview and publish profile  |
 *
 * ## Usage
 *
 * Each schema is used with React Hook Form via the zodResolver:
 *
 * ```typescript
 * import { coachBasicInfoSchema, CoachBasicInfoFormData } from '@/lib/validators/coach-onboarding';
 * import { zodResolver } from '@hookform/resolvers/zod';
 *
 * const form = useForm<CoachBasicInfoFormData>({
 *   resolver: zodResolver(coachBasicInfoSchema),
 *   defaultValues: { ... }
 * });
 * ```
 *
 * ## Price Storage Convention
 *
 * **IMPORTANT**: All prices in this module and database are stored in CENTS (integers).
 * Form components should convert to/from dollars for user display.
 *
 * @module validators/coach-onboarding
 * @see {@link file://src/components/onboarding} - Form components using these schemas
 * @see {@link file://src/db/schema.ts} - Database schema for coach_profiles
 */

import { z } from 'zod';

/* =============================================================================
   STEP 1: BASIC INFO SCHEMA
   ============================================================================= */

/**
 * Validation schema for Step 1 of coach onboarding: Basic Information.
 *
 * Collects the coach's public identity information displayed on their profile card.
 *
 * ## Fields
 *
 * | Field           | Type     | Required | Constraints                        |
 * |-----------------|----------|----------|------------------------------------|
 * | displayName     | string   | Yes      | 2-100 characters                   |
 * | headline        | string   | Yes      | 10-150 characters                  |
 * | profilePhotoUrl | string   | No       | Valid URL or empty string          |
 * | timezone        | string   | Yes      | IANA timezone identifier           |
 *
 * @example
 * ```typescript
 * const validData: CoachBasicInfoFormData = {
 *   displayName: 'Sarah Johnson',
 *   headline: 'Executive Coach | Leadership Development Expert',
 *   profilePhotoUrl: 'https://example.com/photo.jpg',
 *   timezone: 'America/New_York'
 * };
 *
 * const result = coachBasicInfoSchema.safeParse(validData);
 * if (!result.success) {
 *   console.error(result.error.flatten());
 * }
 * ```
 */
export const coachBasicInfoSchema = z.object({
  /** Coach's public display name (2-100 chars). Shown on profile cards and search results. */
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name must be less than 100 characters'),
  /** One-line professional tagline (10-150 chars). Appears below name on profile card. */
  headline: z
    .string()
    .min(10, 'Headline must be at least 10 characters')
    .max(150, 'Headline must be less than 150 characters'),
  /** Optional profile photo URL. Falls back to Clerk avatar or initials if empty. */
  profilePhotoUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  /** IANA timezone identifier (e.g., 'America/New_York'). Used for availability display. */
  timezone: z.string().min(1, 'Please select a timezone'),
});

/**
 * TypeScript type inferred from {@link coachBasicInfoSchema}.
 *
 * Use this type for form data and component props.
 */
export type CoachBasicInfoFormData = z.infer<typeof coachBasicInfoSchema>;

/* =============================================================================
   CONSTANTS: COACH SPECIALTIES
   ============================================================================= */

/**
 * Predefined coaching specialty tags available during onboarding.
 *
 * Coaches can select one or more of these specialties to describe their practice.
 * These tags are displayed on coach profiles and used for search/filter functionality.
 *
 * ## Usage
 *
 * - **Selection UI**: Displayed as toggleable chips in bio-specialties-form.tsx
 * - **Custom Specialties**: Coaches can also add custom specialties not in this list
 * - **Storage**: Selected specialties stored as string[] in coach_profiles.specialties
 *
 * @example
 * ```typescript
 * // Type-safe specialty selection
 * type Specialty = (typeof COACH_SPECIALTIES)[number];
 *
 * // Validate against predefined specialties
 * const isValid = COACH_SPECIALTIES.includes(selectedSpecialty as Specialty);
 *
 * // Filter coaches by specialty
 * const careerCoaches = coaches.filter(c =>
 *   c.specialties.includes('Career Coaching')
 * );
 * ```
 *
 * @constant
 * @readonly
 */
export const COACH_SPECIALTIES = [
  'Life Coaching',
  'Career Coaching',
  'Health & Wellness',
  'Executive Coaching',
  'Relationship Coaching',
  'Business Coaching',
  'Leadership Coaching',
  'Mindset & Motivation',
  'Financial Coaching',
  'Parenting Coaching',
  'Spiritual Coaching',
  'Performance Coaching',
] as const;

/* =============================================================================
   STEP 2: BIO & SPECIALTIES SCHEMA
   ============================================================================= */

/**
 * Validation schema for Step 2 of coach onboarding: Bio and Specialties.
 *
 * Collects the coach's professional biography and area of expertise tags.
 *
 * ## Fields
 *
 * | Field       | Type     | Required | Constraints                        |
 * |-------------|----------|----------|------------------------------------|
 * | bio         | string   | No       | Max 2000 characters                |
 * | specialties | string[] | Yes      | At least 1 specialty required      |
 *
 * ## Notes
 *
 * - **Bio**: Supports rich text but stored as plain string. Rendered with line breaks.
 * - **Specialties**: Can include values from {@link COACH_SPECIALTIES} or custom strings.
 *
 * @example
 * ```typescript
 * const validData: CoachBioSpecialtiesFormData = {
 *   bio: 'With 15 years of experience in executive leadership...',
 *   specialties: ['Executive Coaching', 'Leadership Coaching', 'Team Dynamics']
 * };
 *
 * const result = coachBioSpecialtiesSchema.safeParse(validData);
 * ```
 */
export const coachBioSpecialtiesSchema = z.object({
  /** Coach's professional biography. Optional but recommended for profile completeness. */
  bio: z.string().max(2000, 'Bio must be less than 2000 characters').optional().or(z.literal('')),
  /** Coaching specialty tags. Must have at least one. Can be from COACH_SPECIALTIES or custom. */
  specialties: z
    .array(z.string().min(1, 'Specialty cannot be empty'))
    .min(1, 'Please select at least one specialty'),
});

/**
 * TypeScript type inferred from {@link coachBioSpecialtiesSchema}.
 */
export type CoachBioSpecialtiesFormData = z.infer<typeof coachBioSpecialtiesSchema>;

/* =============================================================================
   HELPER FUNCTIONS
   ============================================================================= */

/**
 * Generates a URL-friendly slug from a display name.
 *
 * Used to create the unique coach profile URL path (e.g., `/coaches/sarah-johnson`).
 * The slug is stored in `coach_profiles.slug` and must be unique across all coaches.
 *
 * ## Transformation Rules
 *
 * 1. Convert to lowercase
 * 2. Remove leading/trailing whitespace
 * 3. Remove special characters (keeps only alphanumeric, spaces, hyphens)
 * 4. Replace spaces with hyphens
 * 5. Collapse multiple hyphens to single hyphen
 * 6. Truncate to 50 characters maximum
 *
 * @param name - The coach's display name to convert
 * @returns URL-safe slug string (max 50 characters)
 *
 * @example
 * ```typescript
 * generateSlug('Sarah Johnson')        // 'sarah-johnson'
 * generateSlug('Dr. John O\'Brien')    // 'dr-john-obrien'
 * generateSlug('  Jane   Doe  ')       // 'jane-doe'
 * generateSlug('María García-López')   // 'mara-garca-lpez'
 * ```
 *
 * @remarks
 * The server-side onboarding action may append a numeric suffix if the slug
 * already exists (e.g., 'sarah-johnson-2').
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .substring(0, 50); // Limit length
}

/* =============================================================================
   CONSTANTS: PRICING & CURRENCY
   ============================================================================= */

/**
 * Supported currencies for coach pricing and payments.
 *
 * Coaches select their preferred currency during onboarding Step 3.
 * This currency applies to all their session types and is used for
 * Stripe checkout sessions.
 *
 * ## Currency Object Structure
 *
 * | Property | Type   | Description                              |
 * |----------|--------|------------------------------------------|
 * | code     | string | ISO 4217 currency code (e.g., 'USD')     |
 * | symbol   | string | Display symbol (e.g., '$')               |
 * | name     | string | Human-readable name (e.g., 'US Dollar')  |
 *
 * @example
 * ```typescript
 * // Find currency by code
 * const usd = SUPPORTED_CURRENCIES.find(c => c.code === 'USD');
 * // { code: 'USD', symbol: '$', name: 'US Dollar' }
 *
 * // Format price with currency symbol
 * const formatPrice = (cents: number, currencyCode: CurrencyCode) => {
 *   const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
 *   return `${currency?.symbol}${(cents / 100).toFixed(2)}`;
 * };
 * ```
 *
 * @constant
 * @readonly
 */
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
] as const;

/**
 * Union type of supported ISO 4217 currency codes.
 *
 * @example
 * ```typescript
 * const currency: CurrencyCode = 'USD'; // Valid
 * const invalid: CurrencyCode = 'XYZ'; // TypeScript error
 * ```
 */
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

/**
 * Available session durations in minutes.
 *
 * Coaches select from these preset durations when creating session types.
 * These align with common coaching session lengths and calendar slot sizes.
 *
 * @example
 * ```typescript
 * // Validate duration
 * const isValidDuration = SESSION_DURATIONS.includes(selectedDuration as SessionDuration);
 *
 * // Format for display
 * const formatDuration = (minutes: SessionDuration) =>
 *   minutes >= 60 ? `${minutes / 60}h` : `${minutes}min`;
 * ```
 *
 * @constant
 * @readonly
 */
export const SESSION_DURATIONS = [15, 30, 45, 60, 90, 120] as const;

/**
 * Union type of valid session durations in minutes.
 * Values: 15 | 30 | 45 | 60 | 90 | 120
 */
export type SessionDuration = (typeof SESSION_DURATIONS)[number];

/* =============================================================================
   STEP 3: SESSION TYPE & PRICING SCHEMAS
   ============================================================================= */

/**
 * Validation schema for individual session types offered by a coach.
 *
 * Each coach can define multiple session types with different names, durations,
 * and prices. Clients choose a session type when booking.
 *
 * ## Fields
 *
 * | Field    | Type   | Required | Constraints                                 |
 * |----------|--------|----------|---------------------------------------------|
 * | id       | string | Yes      | Unique identifier (format: session_{ts}_{r})|
 * | name     | string | Yes      | 1-100 characters                            |
 * | duration | number | Yes      | One of: 15, 30, 45, 60, 90, 120 minutes     |
 * | price    | number | Yes      | **Price in CENTS** (0 for free sessions)    |
 *
 * ## ID Format
 *
 * Session type IDs are generated client-side with format: `session_{timestamp}_{random7chars}`
 *
 * @example
 * ```typescript
 * const sessionType: SessionTypeFormData = {
 *   id: 'session_1706745600000_abc1234',
 *   name: 'Discovery Call',
 *   duration: 30,
 *   price: 0  // Free introductory session
 * };
 *
 * const paidSession: SessionTypeFormData = {
 *   id: 'session_1706745600001_xyz7890',
 *   name: '1-Hour Deep Dive',
 *   duration: 60,
 *   price: 15000  // $150.00 in cents
 * };
 * ```
 *
 * @remarks
 * **IMPORTANT**: The `price` field is stored in CENTS (integer).
 * - $150.00 = 15000 cents
 * - $99.99 = 9999 cents
 * - Free = 0 cents
 *
 * Form components must convert to/from dollars for display.
 */
export const sessionTypeSchema = z.object({
  /** Unique identifier. Format: session_{timestamp}_{random7chars} */
  id: z.string().min(1),
  /** Display name for the session type. Shown during booking. */
  name: z
    .string()
    .min(1, 'Session name is required')
    .max(100, 'Name must be less than 100 characters'),
  /** Duration in minutes. Must be one of SESSION_DURATIONS. */
  duration: z.number().refine((val) => SESSION_DURATIONS.includes(val as SessionDuration), {
    message: 'Please select a valid duration',
  }),
  /** Price in CENTS (integer). Use 0 for free sessions. */
  price: z.number().min(0, 'Price must be 0 or greater'),
});

/**
 * TypeScript type inferred from {@link sessionTypeSchema}.
 *
 * @property id - Unique identifier (format: session_{timestamp}_{random})
 * @property name - Session display name (1-100 chars)
 * @property duration - Duration in minutes (15|30|45|60|90|120)
 * @property price - **Price in CENTS** (integer, 0 for free)
 */
export type SessionTypeFormData = z.infer<typeof sessionTypeSchema>;

/**
 * Validation schema for Step 3 of coach onboarding: Pricing.
 *
 * Collects the coach's currency preference and their offered session types.
 * At least one session type is required before a coach can publish their profile.
 *
 * ## Fields
 *
 * | Field        | Type              | Required | Constraints                           |
 * |--------------|-------------------|----------|---------------------------------------|
 * | hourlyRate   | number            | No       | Optional reference rate (in CENTS)    |
 * | currency     | string            | Yes      | Must be in SUPPORTED_CURRENCIES       |
 * | sessionTypes | SessionTypeData[] | Yes      | At least 1 session type required      |
 *
 * ## Currency Selection
 *
 * The selected currency applies to all session prices and is passed to Stripe
 * during checkout. Prices are always stored in the smallest currency unit (cents).
 *
 * @example
 * ```typescript
 * const validData: CoachPricingFormData = {
 *   hourlyRate: 12500,  // $125/hour reference (optional)
 *   currency: 'USD',
 *   sessionTypes: [
 *     { id: 'session_1_abc', name: 'Discovery Call', duration: 30, price: 0 },
 *     { id: 'session_2_xyz', name: 'Strategy Session', duration: 60, price: 15000 }
 *   ]
 * };
 *
 * const result = coachPricingSchema.safeParse(validData);
 * ```
 *
 * @see {@link sessionTypeSchema} - Schema for individual session types
 * @see {@link SUPPORTED_CURRENCIES} - List of valid currency codes
 */
export const coachPricingSchema = z.object({
  /** Optional reference hourly rate in CENTS. For display purposes only. */
  hourlyRate: z.number().min(0, 'Hourly rate must be 0 or greater').optional().nullable(),
  /** ISO 4217 currency code. Must be from SUPPORTED_CURRENCIES. */
  currency: z.string().refine((val) => SUPPORTED_CURRENCIES.some((c) => c.code === val), {
    message: 'Please select a valid currency',
  }),
  /** Array of session offerings. At least one required to publish profile. */
  sessionTypes: z.array(sessionTypeSchema).min(1, 'Please add at least one session type'),
});

/**
 * TypeScript type inferred from {@link coachPricingSchema}.
 *
 * @property hourlyRate - Optional reference rate in CENTS
 * @property currency - ISO 4217 currency code from SUPPORTED_CURRENCIES
 * @property sessionTypes - Array of session type offerings (min 1)
 */
export type CoachPricingFormData = z.infer<typeof coachPricingSchema>;
