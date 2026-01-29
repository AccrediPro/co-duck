import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserX } from 'lucide-react';

export default function CoachNotFound() {
  return (
    <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4 py-8">
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <UserX className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Coach Not Found</CardTitle>
          <CardDescription>
            The coach profile you&apos;re looking for doesn&apos;t exist or is not currently
            available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The coach may have unpublished their profile, or the link may be incorrect.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link href="/coaches">Browse All Coaches</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
