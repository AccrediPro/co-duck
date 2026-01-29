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

interface ProfileData {
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
  bio: string | null;
  specialties: string[] | null;
  timezone: string | null;
  hourlyRate: number | null;
  currency: string | null;
  sessionTypes: SessionType[] | null;
  slug: string;
  isPublished: boolean;
}

interface ReviewPublishFormProps {
  profile: ProfileData;
  missingItems: string[];
  completionPercentage: number;
}

export function ReviewPublishForm({
  profile,
  missingItems,
  completionPercentage,
}: ReviewPublishFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const currency = SUPPORTED_CURRENCIES.find((c) => c.code === profile.currency);
  const currencySymbol = currency?.symbol || '$';

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-500" />
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
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
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
              <h3 className="text-xl font-semibold">{profile.displayName || 'No name set'}</h3>
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
                    {specialty}
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
                    <div className="flex items-center gap-1 text-lg font-semibold">
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
            <Button onClick={handlePublish} disabled={isPublishing || isSavingDraft}>
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
