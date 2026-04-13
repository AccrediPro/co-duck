'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ProfileCompletionBannerProps {
  profileExists: boolean;
  hasBio: boolean;
  hasSessionTypes: boolean;
  isPublished: boolean;
}

export function ProfileCompletionBanner({
  profileExists,
  hasBio,
  hasSessionTypes,
  isPublished,
}: ProfileCompletionBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Profile is complete when all fields are filled and published
  const isComplete = profileExists && hasBio && hasSessionTypes && isPublished;

  if (isComplete || dismissed) return null;

  const message = !profileExists
    ? "Your coach profile hasn't been set up yet. Complete it to start receiving bookings."
    : !hasBio || !hasSessionTypes
      ? 'Your coach profile is missing some key information. Fill in your bio and session types to go live.'
      : 'Your profile is ready — publish it to appear in the coach directory and start receiving bookings.';

  return (
    <Alert className="mb-4 border-gold/30 bg-gold/10">
      <AlertCircle className="h-4 w-4 text-gold-dark" />
      <AlertTitle className="text-gold-dark">Complete your coach profile</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-gold-dark">{message}</span>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" variant="outline" className="border-gold/40 hover:bg-gold/15">
            <Link href={!hasBio ? '/onboarding/coach' : '/dashboard/profile'}>
              Complete Profile
            </Link>
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-sm p-1 text-gold-dark hover:bg-gold/15"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
