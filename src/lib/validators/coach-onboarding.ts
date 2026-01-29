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
