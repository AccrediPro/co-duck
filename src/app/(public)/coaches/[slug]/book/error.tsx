'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function BookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ slug: string }>();

  useEffect(() => {
    console.error('Booking error:', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30">
          <AlertTriangle className="h-10 w-10 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        </div>

        <h2 className="mb-2 text-xl font-semibold">Booking unavailable</h2>

        <p className="mb-6 text-muted-foreground">
          Something went wrong with the booking process. No payment has been charged — please try again.
        </p>

        {error.digest && (
          <p className="mb-4 text-xs text-muted-foreground">Error ID: {error.digest}</p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset} size="lg">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button variant="outline" asChild size="lg">
            <Link href={params?.slug ? `/coaches/${params.slug}` : '/coaches'}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Coach Profile
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
