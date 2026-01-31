import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, Home, Users } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20 px-4">
      <div className="mx-auto max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="h-12 w-12 text-muted-foreground" />
        </div>

        {/* Error Code */}
        <h1 className="mb-2 text-6xl font-bold text-primary">404</h1>

        {/* Title */}
        <h2 className="mb-4 text-2xl font-semibold">Page Not Found</h2>

        {/* Description */}
        <p className="mb-8 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Don&apos;t worry, let&apos;s get you back on track.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button variant="outline" asChild size="lg">
            <Link href="/coaches">
              <Users className="mr-2 h-4 w-4" />
              Browse Coaches
            </Link>
          </Button>
        </div>

        {/* Help Text */}
        <p className="mt-8 text-sm text-muted-foreground">
          Need help?{' '}
          <Link href="/contact" className="text-primary underline hover:no-underline">
            Contact us
          </Link>
        </p>
      </div>
    </div>
  );
}
