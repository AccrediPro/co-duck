import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { eq, and, or, lt, sql } from 'drizzle-orm';
import Link from 'next/link';
import { formatDate, formatDateLong, formatTime, formatDateWithTime } from '@/lib/date-utils';
import { db, bookings, users, coachProfiles, transactions, sessionNotes, reviews } from '@/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
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
import { SessionPrepView } from '@/components/session-prep/session-prep-view';
import { BookingResponseActions } from './booking-response-actions';
import { PaymentSection } from './payment-section';
import { MeetingLinkSection } from './meeting-link-section';
import { SessionReviewSection } from './session-review-section';
import { AiNotesCard } from '@/components/sessions/ai-notes';

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

  // Run all independent queries in parallel after the booking fetch
  // Coach-specific queries
  const coachQueriesPromise = isCoachView
    ? Promise.all([
        db
          .select({ name: users.name, avatar: users.avatarUrl, email: users.email })
          .from(users)
          .where(eq(users.id, session.clientId))
          .limit(1),
        db
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
          ),
        db
          .select({
            content: sessionNotes.content,
            templateId: sessionNotes.templateId,
            sections: sessionNotes.sections,
          })
          .from(sessionNotes)
          .where(eq(sessionNotes.bookingId, sessionId))
          .limit(1),
      ])
    : null;

  const clientQueryPromise = !isCoachView
    ? db
        .select({
          name: users.name,
          avatar: users.avatarUrl,
          email: users.email,
          slug: coachProfiles.slug,
        })
        .from(users)
        .innerJoin(coachProfiles, eq(users.id, coachProfiles.userId))
        .where(eq(users.id, session.coachId))
        .limit(1)
    : null;

  // Shared queries — always needed regardless of view
  const [transactionData, reviewData, coachResults, clientResult] = await Promise.all([
    db
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
      .limit(1),
    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        title: reviews.title,
        content: reviews.content,
        coachResponse: reviews.coachResponse,
        createdAt: reviews.createdAt,
        clientId: reviews.clientId,
      })
      .from(reviews)
      .where(eq(reviews.bookingId, sessionId))
      .limit(1),
    coachQueriesPromise,
    clientQueryPromise,
  ]);

  // Build otherParty from results
  let otherParty: {
    name: string | null;
    avatar: string | null;
    email: string;
    slug?: string;
  } | null = null;
  let pastSessionsCount = 0;
  let sessionNoteContent: string | null = null;
  let sessionNoteTemplateId: number | null = null;
  let sessionNoteSections: Record<string, string> | null = null;

  if (isCoachView && coachResults) {
    const [clientData, countResult, noteData] = coachResults;
    if (clientData.length > 0) {
      otherParty = {
        name: clientData[0].name,
        avatar: clientData[0].avatar,
        email: clientData[0].email,
      };
    }
    pastSessionsCount = countResult[0]?.count || 0;
    if (noteData.length > 0) {
      sessionNoteContent = noteData[0].content;
      sessionNoteTemplateId = noteData[0].templateId ?? null;
      sessionNoteSections = noteData[0].sections as Record<string, string> | null;
    }
  } else if (clientResult) {
    if (clientResult.length > 0) {
      otherParty = {
        name: clientResult[0].name,
        avatar: clientResult[0].avatar,
        email: clientResult[0].email,
        slug: clientResult[0].slug,
      };
    }
  }

  const transaction = transactionData.length > 0 ? transactionData[0] : null;

  // Build review display (needs client name — fetch only if review exists)
  let reviewForDisplay: {
    id: number;
    rating: number;
    title: string | null;
    content: string | null;
    coachResponse: string | null;
    createdAt: string;
    clientName: string;
  } | null = null;

  if (reviewData.length > 0) {
    const r = reviewData[0];
    let clientName = 'Client';
    const clientInfo = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, r.clientId))
      .limit(1);
    if (clientInfo.length > 0 && clientInfo[0].name) {
      clientName = clientInfo[0].name;
    }
    reviewForDisplay = {
      id: r.id,
      rating: r.rating,
      title: r.title,
      content: r.content,
      coachResponse: r.coachResponse,
      createdAt: r.createdAt.toISOString(),
      clientName,
    };
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

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const backLink = isCoachView ? '/dashboard/sessions' : '/dashboard/my-sessions';
  const isUpcoming = new Date(session.startTime) > new Date();
  const canTakeAction =
    isUpcoming && session.status !== 'cancelled' && session.status !== 'completed';
  const isPendingApproval = isCoachView && session.status === 'pending' && isUpcoming;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href={backLink}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {isCoachView ? 'Sessions' : 'My Sessions'}
        </Link>
      </Button>

      {/* Page Header Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-2xl font-bold">Session Details</CardTitle>
            <StatusBadge
              status={session.status}
              label={session.status === 'pending' ? 'Pending Approval' : undefined}
            />
          </div>
          <CardDescription>
            Booking #{session.id} - Created {formatDate(session.createdAt)}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Content */}
      <div className="space-y-6">
        {/* Pending Approval Banner - Coach View */}
        {isPendingApproval && (
          <Card className="border-gold/30 bg-gold/5 dark:border-gold-dark dark:bg-gold-dark/10">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-burgundy-dark dark:text-gold">
                  Booking Request from {otherParty?.name || 'a client'}
                </h3>
                <p className="mt-1 text-sm text-burgundy dark:text-gold/80">
                  This client has requested a session. Accept to confirm or reject to cancel and
                  refund.
                </p>
              </div>
              <BookingResponseActions
                sessionId={session.id}
                clientName={otherParty?.name || 'the client'}
              />
            </CardContent>
          </Card>
        )}

        {/* Other Party Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>{isCoachView ? 'Client' : 'Coach'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={otherParty?.avatar || undefined} alt={otherParty?.name || ''} />
                <AvatarFallback className="text-lg">
                  {otherParty?.name ? getInitials(otherParty.name) : <User className="h-6 w-6" />}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold">
                  {otherParty?.name || (isCoachView ? 'Unknown Client' : 'Coach')}
                </h3>
                {otherParty?.email && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {otherParty.email}
                  </div>
                )}
                {isCoachView && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <History className="h-4 w-4" />
                    {pastSessionsCount === 0
                      ? 'First session with this client'
                      : `${pastSessionsCount} past session${pastSessionsCount === 1 ? '' : 's'} together`}
                  </div>
                )}
              </div>
              {isClientView && otherParty?.slug && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/coaches/${otherParty.slug}`} target="_blank">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Profile
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

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
                <p className="font-medium">{formatDateLong(session.startTime)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Time</p>
                <p className="font-medium">
                  {formatTime(session.startTime)} - {formatTime(session.endTime)} (
                  {session.sessionType.duration} minutes)
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

        {/* Client Session Prep - Only visible to coach */}
        {isCoachView && <SessionPrepView bookingId={session.id} />}

        {/* Editable Coach Notes - Only visible to coach */}
        {isCoachView && (
          <CoachNotesEditor
            sessionId={session.id}
            initialNotes={sessionNoteContent}
            initialTemplateId={sessionNoteTemplateId}
            initialSections={sessionNoteSections}
          />
        )}

        {/* AI Session Notes - Only visible to coach */}
        {isCoachView && <AiNotesCard sessionId={session.id} />}

        {/* Review Section */}
        {reviewForDisplay && (
          <SessionReviewSection review={reviewForDisplay} isCoachView={isCoachView} />
        )}

        {/* Cancellation Info */}
        {session.status === 'cancelled' && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <CardHeader>
              <CardTitle className="text-red-800 dark:text-red-200">Cancellation Details</CardTitle>
            </CardHeader>
            <CardContent className="text-red-700 dark:text-red-300">
              {session.cancelledAt && (
                <p>
                  <strong>Cancelled on:</strong> {formatDateWithTime(session.cancelledAt)}
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

        {/* Actions Card for Coach - Pending approval */}
        {isPendingApproval && (
          <Card>
            <CardHeader>
              <CardTitle>Respond to Request</CardTitle>
              <CardDescription>Accept or reject this booking request</CardDescription>
            </CardHeader>
            <CardContent>
              <BookingResponseActions
                sessionId={session.id}
                clientName={otherParty?.name || 'the client'}
              />
            </CardContent>
          </Card>
        )}

        {/* Actions Card for Coach - Confirmed/upcoming sessions only */}
        {isCoachView && isUpcoming && !isPendingApproval && session.status !== 'cancelled' && (
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
    </div>
  );
}
