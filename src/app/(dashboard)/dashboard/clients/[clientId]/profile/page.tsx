import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { formatMonthYear } from '@/lib/date-utils';
import { db, users, bookings } from '@/db';
import { eq, and } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, User, MapPin, Briefcase, Target, CalendarDays } from 'lucide-react';
import { ClientGroupBadges } from '@/components/dashboard/client-group-badges';

export const metadata = {
  title: 'Client Profile | Coaching Platform',
  description: 'View client profile information',
};

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function ClientProfilePage({ params }: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const { clientId } = await params;

  // Verify the current user is a coach
  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!currentUser || currentUser.role !== 'coach') {
    notFound();
  }

  // Verify the coach has at least one booking with this client
  const sharedBooking = await db.query.bookings.findFirst({
    where: and(eq(bookings.coachId, userId), eq(bookings.clientId, clientId)),
  });

  if (!sharedBooking) {
    notFound();
  }

  // Fetch client profile
  const client = await db.query.users.findFirst({
    where: eq(users.id, clientId),
  });

  if (!client) {
    notFound();
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const hasProfileInfo = client.bio || client.city || client.occupation || client.goals;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/dashboard/sessions">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sessions
        </Link>
      </Button>

      {/* Page Header Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{client.name || 'Client Profile'}</CardTitle>
          <CardDescription>Client profile</CardDescription>
        </CardHeader>
      </Card>

      {/* Content */}
      <div className="space-y-6">
        {/* Profile Overview Card */}
        <Card>
          <CardContent className="flex flex-col items-center pt-6 text-center">
            <Avatar className="h-24 w-24">
              <AvatarImage src={client.avatarUrl || undefined} alt={client.name || ''} />
              <AvatarFallback className="text-2xl">
                {client.name ? getInitials(client.name) : <User className="h-10 w-10" />}
              </AvatarFallback>
            </Avatar>

            <h2 className="mt-4 text-xl font-semibold">{client.name || 'Unknown Client'}</h2>

            {client.occupation && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                {client.occupation}
              </div>
            )}

            {client.city && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {client.city}
              </div>
            )}

            <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Member since {formatMonthYear(client.createdAt)}
            </div>

            <div className="mt-4">
              <ClientGroupBadges clientId={clientId} />
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        {hasProfileInfo ? (
          <>
            {client.bio && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-muted-foreground">{client.bio}</p>
                </CardContent>
              </Card>
            )}

            {client.goals && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-primary" />
                    Coaching Goals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-muted-foreground">{client.goals}</p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <div className="mb-4 rounded-full bg-muted p-4">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Profile not yet completed</h3>
              <p className="mt-2 max-w-md text-muted-foreground">
                This client hasn&apos;t completed their profile yet. Once they add their
                information, it will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
