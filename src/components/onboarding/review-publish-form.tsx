/**
 * @fileoverview Coach Onboarding Step 4 - Review & Publish Form
 *
 * This component handles the final step of the coach onboarding flow where coaches
 * review their complete profile and choose to publish it or save as draft.
 *
 * @module components/onboarding/review-publish-form
 *
 * ## Flow
 * 1. Displays profile completion percentage and missing items
 * 2. Shows a preview of the coach's public profile as clients will see it
 * 3. Coach can either "Publish Profile" (make live) or "Save as Draft"
 * 4. On success, redirects to coach dashboard
 *
 * ## Data Flow
 * - Input: Complete profile data from previous steps
 * - Output: Sets `isPublished` flag via `publishProfile` server action
 * - Navigation: On success, redirects to `/dashboard`
 *
 * ## Publishing States
 * - Published: Profile is visible in coach directory and bookable
 * - Draft: Profile is saved but not visible to clients
 *
 * ## Profile Preview Sections
 * - Header: Avatar, display name, headline, timezone
 * - About: Coach biography
 * - Specialties: Coaching focus areas as badges
 * - Pricing: Session types with durations and prices
 *
 * ## Completion Tracking
 * The parent page component calculates `completionPercentage` and `missingItems`
 * to help coaches identify what to complete for a better profile.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { publishProfile } from '@/app/(dashboard)/onboarding/coach/actions/publish-profile';
import { useToast } from '@/hooks/use-toast';
import { SUPPORTED_CURRENCIES } from '@/lib/validators/coach-onboarding';
import type { SessionType } from '@/db/schema';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2, Clock, DollarSign, Globe, Loader2, User } from 'lucide-react';

/* ============================================================================
 * TYPE DEFINITIONS
 * ========================================================================= */

/**
 * Complete profile data for review display.
 *
 * All fields come from the `coach_profiles` table.
 * Prices are stored in CENTS.
 *
 * @property displayName - Coach's public display name
 * @property avatarUrl - URL to profile photo
 * @property headline - Professional tagline
 * @property bio - Full biography text
 * @property specialties - Array of coaching specialties
 * @property timezone - IANA timezone string
 * @property hourlyRate - Base hourly rate in CENTS
 * @property currency - Currency code (e.g., "USD")
 * @property sessionTypes - Array of bookable session configurations
 * @property slug - URL-safe profile identifier
 * @property isPublished - Current publication status
 */
interface ProfileData {
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  specialties: Array<{ category: string; subNiches: string[] }> | string[] | null;
  timezone: string | null;
  hourlyRate: number | null;
  currency: string | null;
  sessionTypes: SessionType[] | null;
  slug: string;
  isPublished: boolean;
}

/**
 * Props for the ReviewPublishForm component.
 *
 * @property profile - Complete coach profile data for preview
 * @property missingItems - List of incomplete profile items (e.g., "Add a bio")
 * @property completionPercentage - 0-100 percentage of profile completion
 */
/**
 * Props for the ReviewPublishForm component.
 *
 * @property profile - Complete coach profile data for preview
 * @property missingItems - List of incomplete profile items (e.g., "Add a bio")
 * @property completionPercentage - 0-100 percentage of profile completion
 */
interface ReviewPublishFormProps {
  profile: ProfileData;
  missingItems: string[];
  completionPercentage: number;
}

/* ============================================================================
 * COMPONENT
 * ========================================================================= */

/**
 * Review & Publish Form for coach onboarding step 4 (final step).
 *
 * Displays a complete preview of the coach's profile as it will appear to
 * clients, along with completion status and the ability to publish or save
 * as a draft.
 *
 * @param props - Component props
 * @param props.profile - Complete coach profile data
 * @param props.missingItems - List of incomplete items for improvement suggestions
 * @param props.completionPercentage - Profile completion percentage (0-100)
 *
 * @returns React component rendering the profile review and publish interface
 *
 * @example
 * ```tsx
 * <ReviewPublishForm
 *   profile={{
 *     displayName: "John Smith",
 *     headline: "Executive Coach",
 *     bio: "10 years of experience...",
 *     specialties: ["Executive Coaching"],
 *     timezone: "America/New_York",
 *     hourlyRate: 15000, // $150.00 in cents
 *     currency: "USD",
 *     sessionTypes: [...],
 *     slug: "john-smith",
 *     isPublished: false,
 *     avatarUrl: "https://..."
 *   }}
 *   missingItems={["Consider adding more specialties"]}
 *   completionPercentage={90}
 * />
 * ```
 */
export function ReviewPublishForm({
  profile,
  missingItems,
  completionPercentage,
}: ReviewPublishFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Get currency symbol for price formatting
  const currency = SUPPORTED_CURRENCIES.find((c) => c.code === profile.currency);
  const currencySymbol = currency?.symbol || '$';

  /**
   * Formats a price from cents to dollars with 2 decimal places.
   *
   * @param cents - Price in cents
   * @returns Formatted price string (e.g., "150.00")
   */
  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  /**
   * Extracts initials from a name for avatar fallback.
   *
   * @param name - Full name string
   * @returns Up to 2 uppercase initials (e.g., "JS" for "John Smith")
   */
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  /**
   * Handles profile publishing.
   *
   * Sets isPublished=true via server action, shows success toast,
   * and navigates to dashboard.
   */
  /**
   * Handles profile publishing.
   *
   * Sets isPublished=true via server action, shows success toast,
   * and navigates to dashboard.
   */
  async function handlePublish() {
    setIsPublishing(true);
    try {
      const result = await publishProfile(true);
      if (result.success) {
        toast({
          title: 'Profile Published!',
          description: 'Your coach profile is now live and visible to clients.',
        });
        router.push('/dashboard');
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsPublishing(false);
    }
  }

  /**
   * Handles saving profile as draft.
   *
   * Sets isPublished=false via server action, shows success toast,
   * and navigates to dashboard. Profile is saved but not visible to clients.
   */
  async function handleSaveDraft() {
    setIsSavingDraft(true);
    try {
      const result = await publishProfile(false);
      if (result.success) {
        toast({
          title: 'Draft Saved',
          description: 'Your profile has been saved as a draft. You can publish it later.',
        });
        router.push('/dashboard');
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsSavingDraft(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile Completion Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {completionPercentage === 100 ? (
              <CheckCircle2 className="h-5 w-5 text-sage" />
            ) : (
              <AlertCircle className="h-5 w-5 text-gold" />
            )}
            Profile Completion: {completionPercentage}%
          </CardTitle>
          {missingItems.length > 0 && (
            <CardDescription>
              Complete these items to improve your profile visibility:
            </CardDescription>
          )}
        </CardHeader>
        {missingItems.length > 0 && (
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {missingItems.map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      {/* Profile Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Preview</CardTitle>
          <CardDescription>
            This is how your profile will appear to potential clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Header Section */}
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatarUrl || undefined} alt={profile.displayName} />
              <AvatarFallback className="text-lg">
                {profile.displayName ? (
                  getInitials(profile.displayName)
                ) : (
                  <User className="h-8 w-8" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-burgundy-dark">
                {profile.displayName || 'No name set'}
              </h3>
              <p className="text-muted-foreground">{profile.headline || 'No headline set'}</p>
              {profile.timezone && (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  {profile.timezone}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Bio Section */}
          <div>
            <h4 className="mb-2 font-medium">About</h4>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {profile.bio || 'No bio added yet.'}
            </p>
          </div>

          <Separator />

          {/* Specialties Section */}
          <div>
            <h4 className="mb-2 font-medium">Specialties</h4>
            {profile.specialties && profile.specialties.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.specialties.map((specialty, index) => (
                  <Badge key={index} variant="secondary">
                    {typeof specialty === 'string' ? specialty : specialty.category}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No specialties selected.</p>
            )}
          </div>

          <Separator />

          {/* Pricing Section */}
          <div>
            <h4 className="mb-2 font-medium">Session Types & Pricing</h4>
            {profile.sessionTypes && profile.sessionTypes.length > 0 ? (
              <div className="space-y-3">
                {profile.sessionTypes.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{session.name}</p>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {session.duration} minutes
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-lg font-semibold text-burgundy-dark">
                      <DollarSign className="h-4 w-4" />
                      {currencySymbol}
                      {formatPrice(session.price)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No session types configured.</p>
            )}
            {profile.hourlyRate && (
              <p className="mt-2 text-sm text-muted-foreground">
                Base hourly rate: {currencySymbol}
                {formatPrice(profile.hourlyRate)} {profile.currency}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:justify-between">
          <Button variant="outline" asChild>
            <Link href="/onboarding/coach/step-3">Back to Step 3</Link>
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isPublishing || isSavingDraft}
            >
              {isSavingDraft ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save as Draft'
              )}
            </Button>
            <Button
              onClick={handlePublish}
              disabled={isPublishing || isSavingDraft}
              className="bg-burgundy text-white hover:bg-burgundy-light"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                'Publish Profile'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
