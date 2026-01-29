import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { eq, and, or, lt, sql } from 'drizzle-orm';
import { format } from 'date-fns';
import Link from 'next/link';
import { db, bookings, users, coachProfiles, transactions, sessionNotes } from '@/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Mail,
  DollarSign,
  FileText,
  ExternalLink,
  History,
} from 'lucide-react';
import { SessionDetailActions } from './session-detail-actions';
import { CoachNotesEditor } from './coach-notes-editor';
import { CoachSessionActions } from './coach-session-actions';
import { PaymentSection } from './payment-section';
import { MeetingLinkSection } from './meeting-link-section';

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

  // Fetch the booking - allow access if user is either coach OR client
  const bookingData = await db
    .select({
      id: bookings.id,
      coachId: bookings.coachId,
      clientId: bookings.clientId,
      sessionType: bookings.sessionType,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
      clientNotes: bookings.clientNotes,
      coachNotes: bookings.coachNotes,
      cancelledAt: bookings.cancelledAt,
      cancellationReason: bookings.cancellationReason,
      meetingLink: bookings.meetingLink,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.id, sessionId),
        or(eq(bookings.coachId, userId), eq(bookings.clientId, userId))
      )
    )
    .limit(1);

  if (bookingData.length === 0) {
    notFound();
  }

  const session = bookingData[0];
  const isCoachView = session.coachId === userId;
  const isClientView = session.clientId === userId;

  // Fetch the other party's info
  let otherParty: {
    name: string | null;
    avatar: string | null;
    email: string;
    slug?: string;
  } | null = null;

  // For coach view: count of past sessions with this client
  let pastSessionsCount = 0;

  if (isCoachView) {
    // Coach viewing - get client info
    const clientData = await db
      .select({
        name: users.name,
        avatar: users.avatarUrl,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, session.clientId))
      .limit(1);

    if (clientData.length > 0) {
      otherParty = {
        name: clientData[0].name,
        avatar: clientData[0].avatar,
        email: clientData[0].email,
      };
    }

    // Get count of past sessions with this client
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.coachId, userId),
          eq(bookings.clientId, session.clientId),
          lt(bookings.startTime, new Date()),
          or(
            eq(bookings.status, 'completed'),
            eq(bookings.status, 'confirmed'),
            eq(bookings.status, 'pending')
          )
        )
      );
    pastSessionsCount = countResult[0]?.count || 0;
  } else {
    // Client viewing - get coach info
    const coachData = await db
      .select({
        name: users.name,
        avatar: users.avatarUrl,
        email: users.email,
        slug: coachProfiles.slug,
      })
      .from(users)
      .innerJoin(coachProfiles, eq(users.id, coachProfiles.userId))
      .where(eq(users.id, session.coachId))
      .limit(1);

    if (coachData.length > 0) {
      otherParty = {
        name: coachData[0].name,
        avatar: coachData[0].avatar,
        email: coachData[0].email,
        slug: coachData[0].slug,
      };
    }
  }

  // Fetch transaction info for this booking (if exists)
  const transactionData = await db
    .select({
      id: transactions.id,
      amountCents: transactions.amountCents,
      currency: transactions.currency,
      platformFeeCents: transactions.platformFeeCents,
      coachPayoutCents: transactions.coachPayoutCents,
      status: transactions.status,
      createdAt: transactions.createdAt,
      stripePaymentIntentId: transactions.stripePaymentIntentId,
    })
    .from(transactions)
    .where(eq(transactions.bookingId, sessionId))
    .limit(1);

  const transaction = transactionData.length > 0 ? transactionData[0] : null;

  // Fetch session note for coach view (from session_notes table)
  let sessionNoteContent: string | null = null;
  if (isCoachView) {
    const noteData = await db
      .select({ content: sessionNotes.content })
      .from(sessionNotes)
      .where(eq(sessionNotes.bookingId, sessionId))
      .limit(1);

    sessionNoteContent = noteData.length > 0 ? noteData[0].content : null;
  }

  // Determine payment status
  type PaymentStatus = 'free' | 'paid' | 'payment_required' | 'payment_failed';
  let paymentStatus: PaymentStatus = 'free';
  if (session.sessionType.price > 0) {
    if (!transaction) {
      paymentStatus = 'payment_required';
    } else if (transaction.status === 'succeeded') {
      paymentStatus = 'paid';
    } else if (transaction.status === 'failed') {
      paymentStatus = 'payment_failed';
    } else {
      paymentStatus = 'payment_required';
    }
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

  const backLink = isCoachView ? '/dashboard/sessions' : '/dashboard/my-sessions';
  const isUpcoming = new Date(session.startTime) > new Date();
  const canTakeAction =
    isUpcoming && session.status !== 'cancelled' && session.status !== 'completed';

  return (
    <div className="space-y-6">
      {/* Back button and header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href={backLink}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to {isCoachView ? 'Sessions' : 'My Sessions'}
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

          {/* Meeting Link Section */}
          <MeetingLinkSection
            sessionId={session.id}
            initialMeetingLink={session.meetingLink}
            isCoachView={isCoachView}
            isUpcoming={isUpcoming}
            isConfirmed={session.status === 'confirmed'}
          />

          {/* Payment Information Card */}
          <PaymentSection
            sessionId={session.id}
            paymentStatus={paymentStatus}
            transaction={transaction}
            sessionPrice={session.sessionType.price}
            isUpcoming={isUpcoming}
            isClientView={isClientView}
          />

          {/* Client Notes Card */}
          {session.clientNotes && (
            <Card>
              <CardHeader>
                <CardTitle>{isCoachView ? 'Client Notes' : 'Your Notes'}</CardTitle>
                <CardDescription>
                  {isCoachView
                    ? 'Notes provided by the client when booking'
                    : 'Notes you provided when booking'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground">{session.clientNotes}</p>
              </CardContent>
            </Card>
          )}

          {/* Editable Coach Notes - Only visible to coach */}
          {isCoachView && (
            <CoachNotesEditor sessionId={session.id} initialNotes={sessionNoteContent} />
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

          {/* Actions Card for Client - Upcoming sessions only */}
          {isClientView && canTakeAction && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Manage your session</CardDescription>
              </CardHeader>
              <CardContent>
                <SessionDetailActions
                  sessionId={session.id}
                  coachId={session.coachId}
                  clientId={session.clientId}
                  coachName={otherParty?.name || 'the coach'}
                  sessionTime={session.startTime}
                  hasPaidTransaction={paymentStatus === 'paid'}
                />
              </CardContent>
            </Card>
          )}

          {/* Actions Card for Coach - Upcoming sessions only */}
          {isCoachView && isUpcoming && session.status !== 'cancelled' && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Manage this session</CardDescription>
              </CardHeader>
              <CardContent>
                <CoachSessionActions
                  sessionId={session.id}
                  coachId={session.coachId}
                  clientId={session.clientId}
                  canCancel={canTakeAction}
                  clientName={otherParty?.name || 'the client'}
                  sessionTime={session.startTime}
                  hasPaidTransaction={paymentStatus === 'paid'}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Other party info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{isCoachView ? 'Client' : 'Coach'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={otherParty?.avatar || undefined} alt={otherParty?.name || ''} />
                  <AvatarFallback className="text-lg">
                    {otherParty?.name ? getInitials(otherParty.name) : <User className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>

                <h3 className="mt-4 text-lg font-semibold">
                  {otherParty?.name || (isCoachView ? 'Unknown Client' : 'Coach')}
                </h3>

                {otherParty?.email && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {otherParty.email}
                  </div>
                )}

                {/* Past sessions count for coach view */}
                {isCoachView && (
                  <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
                    <History className="h-4 w-4" />
                    {pastSessionsCount === 0
                      ? 'First session with this client'
                      : `${pastSessionsCount} past session${pastSessionsCount === 1 ? '' : 's'} together`}
                  </div>
                )}

                {/* Link to coach profile for clients */}
                {isClientView && otherParty?.slug && (
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link href={`/coaches/${otherParty.slug}`} target="_blank">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Profile
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Card for Client */}
          {isClientView && isUpcoming && session.status !== 'cancelled' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <SessionDetailActions
                  sessionId={session.id}
                  coachId={session.coachId}
                  clientId={session.clientId}
                  coachName={otherParty?.name || 'the coach'}
                  sessionTime={session.startTime}
                  variant="sidebar"
                  hasPaidTransaction={paymentStatus === 'paid'}
                />
              </CardContent>
            </Card>
          )}

          {/* Quick Actions Card for Coach */}
          {isCoachView && isUpcoming && session.status !== 'cancelled' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <CoachSessionActions
                  sessionId={session.id}
                  coachId={session.coachId}
                  clientId={session.clientId}
                  canCancel={canTakeAction}
                  clientName={otherParty?.name || 'the client'}
                  sessionTime={session.startTime}
                  variant="sidebar"
                  hasPaidTransaction={paymentStatus === 'paid'}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
