import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Construction } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ConfirmBookingPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Construction className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>Booking Confirmation</CardTitle>
          <CardDescription>
            The booking confirmation page is coming soon. This will allow you to review and confirm
            your booking details.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button asChild>
            <Link href={`/coaches/${slug}/book`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Time Selection
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/coaches/${slug}`}>View Coach Profile</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
