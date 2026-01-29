import { z } from 'zod';

// Step 1: Basic Info validation schema
export const coachBasicInfoSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name must be less than 100 characters'),
  headline: z
    .string()
    .min(10, 'Headline must be at least 10 characters')
    .max(150, 'Headline must be less than 150 characters'),
  profilePhotoUrl: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  timezone: z.string().min(1, 'Please select a timezone'),
});

export type CoachBasicInfoFormData = z.infer<typeof coachBasicInfoSchema>;

// Predefined specialties for coaches
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

// Step 2: Bio & Specialties validation schema
export const coachBioSpecialtiesSchema = z.object({
  bio: z.string().max(2000, 'Bio must be less than 2000 characters').optional().or(z.literal('')),
  specialties: z
    .array(z.string().min(1, 'Specialty cannot be empty'))
    .min(1, 'Please select at least one specialty'),
});

export type CoachBioSpecialtiesFormData = z.infer<typeof coachBioSpecialtiesSchema>;

// Generate a URL-friendly slug from a name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .substring(0, 50); // Limit length
}

// Supported currencies
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

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

// Available session durations in minutes
export const SESSION_DURATIONS = [15, 30, 45, 60, 90, 120] as const;

export type SessionDuration = (typeof SESSION_DURATIONS)[number];

// Session type schema
export const sessionTypeSchema = z.object({
  id: z.string().min(1),
  name: z
    .string()
    .min(1, 'Session name is required')
    .max(100, 'Name must be less than 100 characters'),
  duration: z.number().refine((val) => SESSION_DURATIONS.includes(val as SessionDuration), {
    message: 'Please select a valid duration',
  }),
  price: z.number().min(0, 'Price must be 0 or greater'),
});

export type SessionTypeFormData = z.infer<typeof sessionTypeSchema>;

// Step 3: Pricing validation schema
export const coachPricingSchema = z.object({
  hourlyRate: z.number().min(0, 'Hourly rate must be 0 or greater').optional().nullable(),
  currency: z.string().refine((val) => SUPPORTED_CURRENCIES.some((c) => c.code === val), {
    message: 'Please select a valid currency',
  }),
  sessionTypes: z.array(sessionTypeSchema).min(1, 'Please add at least one session type'),
});

export type CoachPricingFormData = z.infer<typeof coachPricingSchema>;
