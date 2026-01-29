'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  coachBioSpecialtiesSchema,
  COACH_SPECIALTIES,
  type CoachBioSpecialtiesFormData,
} from '@/lib/validators/coach-onboarding';
import { saveBioSpecialties } from '@/app/(dashboard)/onboarding/coach/actions/save-bio-specialties';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, X, Plus } from 'lucide-react';
import Link from 'next/link';

interface BioSpecialtiesFormProps {
  initialData?: {
    bio?: string | null;
    specialties?: string[];
  };
}

export function BioSpecialtiesForm({ initialData }: BioSpecialtiesFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customSpecialty, setCustomSpecialty] = useState('');

  const form = useForm<CoachBioSpecialtiesFormData>({
    resolver: zodResolver(coachBioSpecialtiesSchema),
    defaultValues: {
      bio: initialData?.bio || '',
      specialties: initialData?.specialties || [],
    },
  });

  const watchedBio = form.watch('bio');
  const watchedSpecialties = form.watch('specialties');
  const bioLength = watchedBio?.length || 0;

  const toggleSpecialty = (specialty: string) => {
    const currentSpecialties = form.getValues('specialties');
    if (currentSpecialties.includes(specialty)) {
      form.setValue(
        'specialties',
        currentSpecialties.filter((s) => s !== specialty),
        { shouldValidate: true }
      );
    } else {
      form.setValue('specialties', [...currentSpecialties, specialty], { shouldValidate: true });
    }
  };

  const addCustomSpecialty = () => {
    const trimmed = customSpecialty.trim();
    if (trimmed && !watchedSpecialties.includes(trimmed)) {
      form.setValue('specialties', [...watchedSpecialties, trimmed], { shouldValidate: true });
      setCustomSpecialty('');
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomSpecialty();
    }
  };

  async function onSubmit(data: CoachBioSpecialtiesFormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await saveBioSpecialties(data);

      if (result.success) {
        // Navigate to step 3
        router.push('/onboarding/coach/step-3');
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
        <CardTitle>Bio & Specialties</CardTitle>
        <CardDescription>
          Tell potential clients about yourself and your areas of expertise.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Bio */}
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell potential clients about your background, experience, and coaching philosophy. What makes you unique as a coach? What can clients expect when working with you?"
                      className="min-h-[200px] resize-y"
                      maxLength={2000}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    <span className={bioLength > 1900 ? 'text-amber-600' : ''}>
                      {bioLength}/2000 characters
                    </span>
                    {bioLength > 1900 && bioLength <= 2000 && ' - approaching limit'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Specialties */}
            <FormField
              control={form.control}
              name="specialties"
              render={() => (
                <FormItem>
                  <FormLabel>Specialties *</FormLabel>
                  <FormDescription className="mb-3">
                    Select at least one specialty. Click to toggle selection.
                  </FormDescription>

                  {/* Predefined Specialties as Chips */}
                  <div className="flex flex-wrap gap-2">
                    {COACH_SPECIALTIES.map((specialty) => {
                      const isSelected = watchedSpecialties.includes(specialty);
                      return (
                        <button
                          key={specialty}
                          type="button"
                          onClick={() => toggleSpecialty(specialty)}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                          }`}
                        >
                          {specialty}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Specialties (shown if any) */}
                  {watchedSpecialties.filter((s) => !COACH_SPECIALTIES.includes(s as never))
                    .length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-sm font-medium text-muted-foreground">
                        Custom Specialties:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {watchedSpecialties
                          .filter((s) => !COACH_SPECIALTIES.includes(s as never))
                          .map((specialty) => (
                            <span
                              key={specialty}
                              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                            >
                              {specialty}
                              <button
                                type="button"
                                onClick={() => toggleSpecialty(specialty)}
                                className="rounded-full p-0.5 hover:bg-primary-foreground/20"
                              >
                                <X className="h-3 w-3" />
                                <span className="sr-only">Remove {specialty}</span>
                              </button>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Add Custom Specialty */}
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      Add a custom specialty:
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., ADHD Coaching"
                        value={customSpecialty}
                        onChange={(e) => setCustomSpecialty(e.target.value)}
                        onKeyDown={handleCustomKeyDown}
                        className="max-w-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCustomSpecialty}
                        disabled={!customSpecialty.trim()}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  </div>

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

            {/* Navigation buttons */}
            <div className="flex justify-between">
              <Button variant="outline" asChild>
                <Link href="/onboarding/coach">Back to Step 1</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Continue to Step 3'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
