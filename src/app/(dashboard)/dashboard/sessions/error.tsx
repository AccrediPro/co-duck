'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

export default function SessionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Sessions error:', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/30">
          <AlertTriangle
            className="h-10 w-10 text-orange-600 dark:text-orange-400"
            aria-hidden="true"
          />
        </div>

        <h2 className="mb-2 text-xl font-semibold">Something went wrong loading your sessions</h2>

        <p className="mb-6 text-muted-foreground">
          We couldn&apos;t load your sessions right now. Your bookings and session data are safe —
          please try again.
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
            <Link href="/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
