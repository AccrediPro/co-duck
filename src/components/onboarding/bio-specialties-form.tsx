/**
 * @fileoverview Coach Onboarding Step 2 - Bio & Specialties Form
 *
 * Presents a 2-level specialty picker: coaches first select one or more
 * top-level categories (Health & Wellness, Career, Life…), then choose
 * relevant sub-niches within those categories.
 *
 * @module components/onboarding/bio-specialties-form
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  coachBioSpecialtiesSchema,
  COACH_CATEGORIES,
  type CoachBioSpecialtiesFormData,
  type SpecialtyEntry,
} from '@/lib/validators/coach-onboarding';
import { saveBioSpecialties } from '@/app/(dashboard)/onboarding/coach/actions/save-bio-specialties';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface BioSpecialtiesFormProps {
  initialData?: {
    bio?: string | null;
    specialties?: Array<{ category: string; subNiches: string[] }>;
  };
}

export function BioSpecialtiesForm({ initialData }: BioSpecialtiesFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track which categories are expanded to show sub-niches
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () =>
      new Set(
        (initialData?.specialties ?? [])
          .filter((s) => s.subNiches.length > 0)
          .map((s) => s.category)
      )
  );

  const form = useForm<CoachBioSpecialtiesFormData>({
    resolver: zodResolver(coachBioSpecialtiesSchema),
    defaultValues: {
      bio: initialData?.bio || '',
      specialties: initialData?.specialties ?? [],
    },
  });

  const watchedBio = form.watch('bio');
  const watchedSpecialties = form.watch('specialties');
  const bioLength = watchedBio?.length || 0;

  // ── helpers ──────────────────────────────────────────────────────────────

  function getCategoryEntry(categoryLabel: string): SpecialtyEntry | undefined {
    return watchedSpecialties.find((s) => s.category === categoryLabel);
  }

  function isCategorySelected(categoryLabel: string): boolean {
    return watchedSpecialties.some((s) => s.category === categoryLabel);
  }

  function isSubNicheSelected(categoryLabel: string, subLabel: string): boolean {
    const entry = getCategoryEntry(categoryLabel);
    return entry?.subNiches.includes(subLabel) ?? false;
  }

  // ── category toggle ───────────────────────────────────────────────────────

  function toggleCategory(categoryLabel: string, hasSubNiches: boolean) {
    const current = form.getValues('specialties');
    const exists = current.some((s) => s.category === categoryLabel);

    if (exists) {
      // Deselect — remove the entry entirely
      form.setValue(
        'specialties',
        current.filter((s) => s.category !== categoryLabel),
        { shouldValidate: true }
      );
      // Collapse if it had sub-niches
      if (hasSubNiches) {
        setExpandedCategories((prev) => {
          const next = new Set(prev);
          next.delete(categoryLabel);
          return next;
        });
      }
    } else {
      // Select — add with empty subNiches
      form.setValue('specialties', [...current, { category: categoryLabel, subNiches: [] }], {
        shouldValidate: true,
      });
      // Auto-expand if it has sub-niches
      if (hasSubNiches) {
        setExpandedCategories((prev) => new Set([...prev, categoryLabel]));
      }
    }
  }

  // ── sub-niche toggle ──────────────────────────────────────────────────────

  function toggleSubNiche(categoryLabel: string, subLabel: string) {
    const current = form.getValues('specialties');
    const entryIdx = current.findIndex((s) => s.category === categoryLabel);

    if (entryIdx === -1) {
      // Parent not selected — auto-select parent too
      form.setValue(
        'specialties',
        [...current, { category: categoryLabel, subNiches: [subLabel] }],
        { shouldValidate: true }
      );
    } else {
      const entry = current[entryIdx];
      const subNiches = entry.subNiches.includes(subLabel)
        ? entry.subNiches.filter((s) => s !== subLabel)
        : [...entry.subNiches, subLabel];
      const updated = [...current];
      updated[entryIdx] = { ...entry, subNiches };
      form.setValue('specialties', updated, { shouldValidate: true });
    }
  }

  function toggleExpandCategory(categoryLabel: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryLabel)) {
        next.delete(categoryLabel);
      } else {
        next.add(categoryLabel);
      }
      return next;
    });
  }

  // ── submit ────────────────────────────────────────────────────────────────

  async function onSubmit(data: CoachBioSpecialtiesFormData) {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await saveBioSpecialties(data);
      if (result.success) {
        router.push('/onboarding/coach/credentials');
      } else {
        setError(result.error);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bio & Specialties</CardTitle>
        <CardDescription>
          Tell potential clients about yourself and the areas you specialize in.
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
                      placeholder="Tell potential clients about your background, experience, and coaching philosophy. What makes you unique? What can clients expect when working with you?"
                      className="min-h-[200px] resize-y"
                      maxLength={2000}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    <span className={bioLength > 1900 ? 'text-gold-dark' : ''}>
                      {bioLength}/2000 characters
                    </span>
                    {bioLength > 1900 && bioLength <= 2000 && ' — approaching limit'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Specialties — 2-level picker */}
            <FormField
              control={form.control}
              name="specialties"
              render={() => (
                <FormItem>
                  <FormLabel>Specialties *</FormLabel>
                  <FormDescription className="mb-3">
                    Select at least one category. Expand categories with sub-niches to get more
                    specific.
                  </FormDescription>

                  <div className="space-y-2">
                    {COACH_CATEGORIES.map((cat) => {
                      const hasSubNiches = cat.subNiches.length > 0;
                      const isSelected = isCategorySelected(cat.label);
                      const isExpanded = expandedCategories.has(cat.label);

                      return (
                        <div key={cat.slug} className="rounded-lg border">
                          {/* Category row */}
                          <div className="flex items-center gap-3 px-4 py-3">
                            <Checkbox
                              id={`cat-${cat.slug}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleCategory(cat.label, hasSubNiches)}
                            />
                            <label
                              htmlFor={`cat-${cat.slug}`}
                              className="flex-1 cursor-pointer text-sm font-medium"
                            >
                              {cat.label}
                            </label>
                            {hasSubNiches && (
                              <button
                                type="button"
                                onClick={() => toggleExpandCategory(cat.label)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                aria-label={isExpanded ? 'Collapse sub-niches' : 'Expand sub-niches'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <span>{cat.subNiches.length} specializations</span>
                              </button>
                            )}
                          </div>

                          {/* Sub-niches (collapsible) */}
                          {hasSubNiches && isExpanded && (
                            <div className="border-t bg-muted/30 px-4 py-3">
                              <p className="mb-2 text-xs font-medium text-muted-foreground">
                                Select specific areas within {cat.label}:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {cat.subNiches.map((sub) => {
                                  const subSelected = isSubNicheSelected(cat.label, sub.label);
                                  return (
                                    <button
                                      key={sub.slug}
                                      type="button"
                                      onClick={() => toggleSubNiche(cat.label, sub.label)}
                                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                        subSelected
                                          ? 'border-primary bg-primary text-primary-foreground'
                                          : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                                      }`}
                                    >
                                      {sub.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Selection summary */}
                  {watchedSpecialties.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Selected:{' '}
                      {watchedSpecialties
                        .map((s) =>
                          s.subNiches.length > 0
                            ? `${s.category} (${s.subNiches.join(', ')})`
                            : s.category
                        )
                        .join(' · ')}
                    </p>
                  )}

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

            {/* Navigation */}
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
