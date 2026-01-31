/**
 * @fileoverview Coach Onboarding Step 1 - Basic Information Form
 *
 * This component handles the first step of the coach onboarding flow where coaches
 * provide their basic profile information: display name, headline, profile photo,
 * and timezone.
 *
 * @module components/onboarding/basic-info-form
 *
 * ## Flow
 * 1. Form pre-populates with user's Clerk name if available
 * 2. Timezone is auto-detected from browser on mount
 * 3. On submit, data is saved via server action and user advances to step 2
 *
 * ## Data Flow
 * - Input: User's Clerk name (optional), existing profile data (for edits)
 * - Output: Saves to `coach_profiles` table via `saveBasicInfo` server action
 * - Navigation: On success, redirects to `/onboarding/coach/step-2`
 *
 * ## Validation
 * Uses Zod schema `coachBasicInfoSchema` from coach-onboarding validators:
 * - displayName: Required, 2-100 characters
 * - headline: Required, 10-150 characters
 * - profilePhotoUrl: Optional, must be valid URL if provided
 * - timezone: Required, must be valid IANA timezone
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  coachBasicInfoSchema,
  type CoachBasicInfoFormData,
} from '@/lib/validators/coach-onboarding';
import { getDetectedTimezone, TIMEZONES, isValidTimezone } from '@/lib/timezones';
import { saveBasicInfo } from '@/app/(dashboard)/onboarding/coach/actions/save-basic-info';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

/* ============================================================================
 * TYPE DEFINITIONS
 * ========================================================================= */

/**
 * Props for the BasicInfoForm component.
 *
 * @property initialData - Pre-existing profile data for editing (optional)
 * @property userName - User's name from Clerk for pre-filling display name (optional)
 */
/**
 * Props for the BasicInfoForm component.
 *
 * @property initialData - Pre-existing profile data for editing (optional)
 * @property userName - User's name from Clerk for pre-filling display name (optional)
 */
interface BasicInfoFormProps {
  initialData?: Partial<CoachBasicInfoFormData>;
  userName?: string | null;
}

/* ============================================================================
 * COMPONENT
 * ========================================================================= */

/**
 * Basic Information Form for coach onboarding step 1.
 *
 * Collects essential profile information from coaches including their public
 * display name, professional headline, profile photo URL, and timezone for
 * scheduling purposes.
 *
 * @param props - Component props
 * @param props.initialData - Pre-existing data for form pre-population
 * @param props.userName - Clerk user's name for display name default
 *
 * @returns React component rendering the basic info form
 *
 * @example
 * ```tsx
 * // New coach onboarding
 * <BasicInfoForm userName="John Smith" />
 *
 * // Editing existing profile
 * <BasicInfoForm
 *   initialData={{
 *     displayName: "John Smith",
 *     headline: "Executive Coach",
 *     timezone: "America/New_York"
 *   }}
 * />
 * ```
 */
export function BasicInfoForm({ initialData, userName }: BasicInfoFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect timezone on mount - defaults to America/New_York if detection fails
  const [detectedTimezone, setDetectedTimezone] = useState<string>('America/New_York');

  // Auto-detect browser timezone on component mount
  useEffect(() => {
    const tz = getDetectedTimezone();
    if (isValidTimezone(tz)) {
      setDetectedTimezone(tz);
    }
  }, []);

  // Initialize form with react-hook-form and Zod validation
  const form = useForm<CoachBasicInfoFormData>({
    resolver: zodResolver(coachBasicInfoSchema),
    defaultValues: {
      displayName: initialData?.displayName || userName || '',
      headline: initialData?.headline || '',
      profilePhotoUrl: initialData?.profilePhotoUrl || '',
      timezone: initialData?.timezone || '',
    },
  });

  // Auto-set timezone from detection if not already populated
  useEffect(() => {
    if (!form.getValues('timezone') && detectedTimezone) {
      form.setValue('timezone', detectedTimezone);
    }
  }, [detectedTimezone, form]);

  /**
   * Handles form submission.
   *
   * Saves basic info via server action and navigates to step 2 on success.
   *
   * @param data - Validated form data
   */
  async function onSubmit(data: CoachBasicInfoFormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await saveBasicInfo(data);

      if (result.success) {
        // Navigate to step 2
        router.push('/onboarding/coach/step-2');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Form submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
        <CardDescription>
          Let&apos;s start with the basics. This information will be visible on your public profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Display Name */}
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Smith" {...field} />
                  </FormControl>
                  <FormDescription>
                    This is how your name will appear on your coach profile.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Headline */}
            <FormField
              control={form.control}
              name="headline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Headline</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Executive Coach helping leaders unlock their potential"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A short tagline that describes what you do ({field.value?.length || 0}/150
                    characters).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Profile Photo URL */}
            <FormField
              control={form.control}
              name="profilePhotoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profile Photo URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/your-photo.jpg" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter a URL to your profile photo. We recommend using a professional headshot.
                  </FormDescription>
                  <FormMessage />
                  {field.value && (
                    <div className="mt-2">
                      <p className="mb-2 text-sm text-muted-foreground">Preview:</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={field.value}
                        alt="Profile preview"
                        className="h-24 w-24 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </FormItem>
              )}
            />

            {/* Timezone */}
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your timezone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Your timezone for scheduling sessions. We detected: {detectedTimezone}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error message */}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Submit button */}
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Continue to Step 2'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
