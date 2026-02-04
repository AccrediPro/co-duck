/**
 * @fileoverview Coach Onboarding Step 3 - Pricing Form
 *
 * This component handles the third step of the coach onboarding flow where coaches
 * configure their pricing: currency, base hourly rate, and session types with
 * individual pricing.
 *
 * @module components/onboarding/pricing-form
 *
 * ## Flow
 * 1. Coach selects their preferred currency (USD, EUR, GBP, etc.)
 * 2. Coach optionally sets a base hourly rate for reference
 * 3. Coach defines session types (name, duration, price) - at least one required
 * 4. On submit, data is saved via server action and user advances to step 4
 *
 * ## Data Flow
 * - Input: Existing pricing data in CENTS (for edits)
 * - Display: Prices shown in DOLLARS for user-friendly editing
 * - Output: Prices converted back to CENTS before saving
 * - Storage: Saves to `coach_profiles` table via `savePricing` server action
 * - Navigation: On success, redirects to `/onboarding/coach/step-4`
 *
 * ## Price Handling
 * IMPORTANT: All prices are stored in the database in CENTS (integer).
 * This component handles the conversion:
 * - On load: cents → dollars (divide by 100)
 * - On save: dollars → cents (multiply by 100, rounded)
 *
 * ## Validation
 * Uses Zod schema `coachPricingSchema` from coach-onboarding validators:
 * - currency: Required, must be supported currency code
 * - hourlyRate: Optional, must be positive if provided
 * - sessionTypes: Required array with at least 1 session type
 *   - name: Required, 2-100 characters
 *   - duration: Required, must be from SESSION_DURATIONS list
 *   - price: Required, must be non-negative
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  coachPricingSchema,
  SUPPORTED_CURRENCIES,
  SESSION_DURATIONS,
  type CoachPricingFormData,
  type SessionTypeFormData,
} from '@/lib/validators/coach-onboarding';
import { savePricing } from '@/app/(dashboard)/onboarding/coach/actions/save-pricing';

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
import { Loader2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

/* ============================================================================
 * TYPE DEFINITIONS
 * ========================================================================= */

/**
 * Props for the PricingForm component.
 *
 * @property initialData - Pre-existing pricing data for editing
 * @property initialData.hourlyRate - Base hourly rate in CENTS
 * @property initialData.currency - Currency code (e.g., "USD", "EUR")
 * @property initialData.sessionTypes - Array of session type configurations
 */
interface PricingFormProps {
  initialData?: {
    hourlyRate?: number | null;
    currency?: string | null;
    sessionTypes?: SessionTypeFormData[];
  };
}

/* ============================================================================
 * HELPER FUNCTIONS
 * ========================================================================= */

/**
 * Generates a unique ID for a new session type.
 *
 * Format: `session_{timestamp}_{random7chars}`
 *
 * @returns Unique session type ID string
 *
 * @example
 * const id = generateSessionId(); // "session_1706745600000_abc123d"
 */
/**
 * Generates a unique ID for a new session type.
 *
 * Format: `session_{timestamp}_{random7chars}`
 *
 * @returns Unique session type ID string
 *
 * @example
 * const id = generateSessionId(); // "session_1706745600000_abc123d"
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/* ============================================================================
 * COMPONENT
 * ========================================================================= */

/**
 * Pricing Form for coach onboarding step 3.
 *
 * Allows coaches to configure their pricing structure including currency
 * selection, optional base hourly rate, and customizable session types with
 * individual pricing. Supports dynamic addition and removal of session types.
 *
 * @param props - Component props
 * @param props.initialData - Pre-existing data for form pre-population (prices in cents)
 *
 * @returns React component rendering the pricing configuration form
 *
 * @example
 * ```tsx
 * // New coach onboarding
 * <PricingForm />
 *
 * // Editing existing pricing (note: prices in CENTS)
 * <PricingForm
 *   initialData={{
 *     hourlyRate: 15000, // $150.00
 *     currency: "USD",
 *     sessionTypes: [
 *       { id: "session_1", name: "Discovery Call", duration: 30, price: 0 },
 *       { id: "session_2", name: "Coaching Session", duration: 60, price: 15000 }
 *     ]
 *   }}
 * />
 * ```
 */
export function PricingForm({ initialData }: PricingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert cents to dollars for user-friendly display
  const initialHourlyRate = initialData?.hourlyRate ? initialData.hourlyRate / 100 : undefined;
  const initialSessionTypes = initialData?.sessionTypes?.map((st) => ({
    ...st,
    price: st.price / 100, // Convert cents to dollars for display
  }));

  // Initialize form with react-hook-form and Zod validation
  const form = useForm<CoachPricingFormData>({
    resolver: zodResolver(coachPricingSchema),
    defaultValues: {
      hourlyRate: initialHourlyRate || null,
      currency: initialData?.currency || 'USD',
      sessionTypes:
        initialSessionTypes && initialSessionTypes.length > 0
          ? initialSessionTypes
          : [{ id: generateSessionId(), name: '', duration: 60, price: 0 }],
    },
  });

  // useFieldArray for dynamic session type management
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'sessionTypes',
  });

  // Get currency symbol for display based on selected currency
  const watchedCurrency = form.watch('currency');
  const currencySymbol =
    SUPPORTED_CURRENCIES.find((c) => c.code === watchedCurrency)?.symbol || '$';

  /**
   * Adds a new empty session type to the form.
   */
  const addSessionType = () => {
    append({ id: generateSessionId(), name: '', duration: 60, price: 0 });
  };

  /**
   * Removes a session type at the given index.
   * Prevents removal if it's the last session type.
   *
   * @param index - Index of the session type to remove
   */
  const removeSessionType = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  /**
   * Handles form submission.
   *
   * Converts prices from dollars to cents before saving via server action.
   * Navigates to step 4 on success.
   *
   * @param data - Validated form data with prices in dollars
   */
  async function onSubmit(data: CoachPricingFormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      // Convert dollars to cents for storage
      const dataInCents = {
        ...data,
        hourlyRate: data.hourlyRate ? Math.round(data.hourlyRate * 100) : null,
        sessionTypes: data.sessionTypes.map((st) => ({
          ...st,
          price: Math.round(st.price * 100),
        })),
      };

      const result = await savePricing(dataInCents);

      if (result.success) {
        router.push('/onboarding/coach/step-4');
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
        <CardTitle>Pricing</CardTitle>
        <CardDescription>
          Set your hourly rate and define the session types you offer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Currency Selector */}
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.symbol} {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Hourly Rate */}
            <FormField
              control={form.control}
              name="hourlyRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Hourly Rate (Optional)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {currencySymbol}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="pl-8"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === '' ? null : parseFloat(val));
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Your base hourly rate for reference. You can set specific prices for each
                    session type below.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Session Types */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-medium leading-none">Session Types *</p>
                  <p className="text-sm text-muted-foreground">
                    Define the types of sessions you offer. At least one is required.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSessionType}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Session
                </Button>
              </div>

              {fields.map((field, index) => (
                <Card key={field.id} className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Session {index + 1}
                      </span>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSessionType(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove session</span>
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      {/* Session Name */}
                      <FormField
                        control={form.control}
                        name={`sessionTypes.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Discovery Call" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Duration */}
                      <FormField
                        control={form.control}
                        name={`sessionTypes.${index}.duration`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Duration</FormLabel>
                            <Select
                              onValueChange={(val) => field.onChange(parseInt(val))}
                              defaultValue={field.value.toString()}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select duration" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {SESSION_DURATIONS.map((duration) => (
                                  <SelectItem key={duration} value={duration.toString()}>
                                    {duration} minutes
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Price */}
                      <FormField
                        control={form.control}
                        name={`sessionTypes.${index}.price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                  {currencySymbol}
                                </span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  className="pl-8"
                                  {...field}
                                  value={field.value ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    field.onChange(val === '' ? 0 : parseFloat(val));
                                  }}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </Card>
              ))}

              {/* Show session types error if no sessions */}
              {form.formState.errors.sessionTypes?.message && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.sessionTypes.message}
                </p>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between">
              <Button variant="outline" asChild>
                <Link href="/onboarding/coach/step-2">Back to Step 2</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Continue to Step 4'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
