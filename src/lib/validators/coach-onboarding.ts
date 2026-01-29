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
