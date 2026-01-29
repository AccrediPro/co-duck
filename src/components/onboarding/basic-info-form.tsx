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

interface BasicInfoFormProps {
  initialData?: Partial<CoachBasicInfoFormData>;
  userName?: string | null;
}

export function BasicInfoForm({ initialData, userName }: BasicInfoFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect timezone on mount
  const [detectedTimezone, setDetectedTimezone] = useState<string>('America/New_York');

  useEffect(() => {
    const tz = getDetectedTimezone();
    if (isValidTimezone(tz)) {
      setDetectedTimezone(tz);
    }
  }, []);

  const form = useForm<CoachBasicInfoFormData>({
    resolver: zodResolver(coachBasicInfoSchema),
    defaultValues: {
      displayName: initialData?.displayName || userName || '',
      headline: initialData?.headline || '',
      profilePhotoUrl: initialData?.profilePhotoUrl || '',
      timezone: initialData?.timezone || '',
    },
  });

  // Set timezone when detected (if not already set)
  useEffect(() => {
    if (!form.getValues('timezone') && detectedTimezone) {
      form.setValue('timezone', detectedTimezone);
    }
  }, [detectedTimezone, form]);

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
