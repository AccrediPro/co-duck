import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { format } from 'date-fns';
import Link from 'next/link';
import { db, bookings, users } from '@/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Calendar, Clock, User, Mail, DollarSign, FileText } from 'lucide-react';

export const metadata = {
  title: 'Session Details | Coaching Platform',
  description: 'View session details',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const { id } = await params;
  const sessionId = parseInt(id, 10);

  if (isNaN(sessionId)) {
    notFound();
  }

  // Fetch the booking with client info
  const bookingData = await db
    .select({
      id: bookings.id,
      coachId: bookings.coachId,
      clientId: bookings.clientId,
      clientName: users.name,
      clientAvatar: users.avatarUrl,
      clientEmail: users.email,
      sessionType: bookings.sessionType,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
      clientNotes: bookings.clientNotes,
      coachNotes: bookings.coachNotes,
      cancelledAt: bookings.cancelledAt,
      cancellationReason: bookings.cancellationReason,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.clientId, users.id))
    .where(and(eq(bookings.id, sessionId), eq(bookings.coachId, userId)))
    .limit(1);

  if (bookingData.length === 0) {
    notFound();
  }

  const session = bookingData[0];

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = () => {
    switch (session.status) {
      case 'confirmed':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            Confirmed
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200">
            Pending
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="border-green-500 text-green-600">
            Completed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-600 hover:bg-red-200">
            Cancelled
          </Badge>
        );
      case 'no_show':
        return (
          <Badge variant="outline" className="border-gray-400 text-gray-500">
            No Show
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Back button and header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/dashboard/sessions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">Session Details</h1>
          {getStatusBadge()}
        </div>
        <p className="text-muted-foreground">
          Booking #{session.id} - Created {format(new Date(session.createdAt), 'MMM d, yyyy')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Session Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Session Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Session Type</p>
                  <p className="font-medium">{session.sessionType.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {format(new Date(session.startTime), 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {format(new Date(session.startTime), 'h:mm a')} -{' '}
                    {format(new Date(session.endTime), 'h:mm a')} ({session.sessionType.duration}{' '}
                    minutes)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Price</p>
                  <p className="font-medium">{formatPrice(session.sessionType.price)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client Notes Card */}
          {session.clientNotes && (
            <Card>
              <CardHeader>
                <CardTitle>Client Notes</CardTitle>
                <CardDescription>Notes provided by the client when booking</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground">{session.clientNotes}</p>
              </CardContent>
            </Card>
          )}

          {/* Coach Notes Card */}
          {session.coachNotes && (
            <Card>
              <CardHeader>
                <CardTitle>Your Notes</CardTitle>
                <CardDescription>Private notes about this session</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground">{session.coachNotes}</p>
              </CardContent>
            </Card>
          )}

          {/* Cancellation Info */}
          {session.status === 'cancelled' && (
            <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
              <CardHeader>
                <CardTitle className="text-red-800 dark:text-red-200">
                  Cancellation Details
                </CardTitle>
              </CardHeader>
              <CardContent className="text-red-700 dark:text-red-300">
                {session.cancelledAt && (
                  <p>
                    <strong>Cancelled on:</strong>{' '}
                    {format(new Date(session.cancelledAt), 'MMMM d, yyyy at h:mm a')}
                  </p>
                )}
                {session.cancellationReason && (
                  <p className="mt-2">
                    <strong>Reason:</strong> {session.cancellationReason}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Client Info */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20">
                  <AvatarImage
                    src={session.clientAvatar || undefined}
                    alt={session.clientName || ''}
                  />
                  <AvatarFallback className="text-lg">
                    {session.clientName ? (
                      getInitials(session.clientName)
                    ) : (
                      <User className="h-8 w-8" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <h3 className="mt-4 text-lg font-semibold">
                  {session.clientName || 'Unknown Client'}
                </h3>

                <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  {session.clientEmail}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
