'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { SUPPORTED_CURRENCIES } from '@/lib/validators/coach-onboarding';
import type { CoachBookingData } from '@/app/(public)/coaches/[slug]/book/actions';
import {
  generateSuccessIcsFile,
  type BookingSuccessData,
} from '@/app/(public)/coaches/[slug]/book/success/actions';
import {
  AlertCircle,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Globe,
  Loader2,
  User,
} from 'lucide-react';
import { formatDateLong, formatTimeInTz } from '@/lib/date-utils';

interface PaymentSuccessContentProps {
  coach: CoachBookingData;
  slug: string;
  booking?: BookingSuccessData;
  error?: string;
  /**
   * Intake form state for this booking, if a form is assigned.
   * `null` when no intake is required.
   */
  intake?: { required: true; submitted: boolean; intakeUrl: string } | null;
}

export function PaymentSuccessContent({
  coach,
  slug,
  booking,
  error,
  intake,
}: PaymentSuccessContentProps) {
  const { toast } = useToast();
  const [isDownloadingIcs, setIsDownloadingIcs] = useState(false);

  // Currency formatting
  const currencyData = SUPPORTED_CURRENCIES.find((c) => c.code === coach.currency);
  const currencySymbol = currencyData?.symbol || '$';

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Handle calendar download
  const handleAddToCalendar = async () => {
    if (!booking) return;

    setIsDownloadingIcs(true);

    const result = await generateSuccessIcsFile(booking.id);

    setIsDownloadingIcs(false);

    if (result.success) {
      // Create and trigger download
      const blob = new Blob([result.data], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `coaching-session-${booking.id}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Calendar Event Downloaded',
        description: 'Open the file to add the event to your calendar.',
      });
    } else {
      toast({
        title: 'Download Failed',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  // Error state - payment may have succeeded but we couldn't verify
  if (error || !booking) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold/15">
              <AlertCircle className="h-8 w-8 text-gold-dark" />
            </div>
            <CardTitle className="text-2xl">Payment Processing</CardTitle>
            <CardDescription>
              Your payment may have been successful, but we&apos;re still processing your booking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-gold/30 bg-gold/10 p-4 text-gold-dark">
              <p className="text-sm">
                {error ||
                  'We are processing your booking. This usually takes just a few seconds. Please check your email for confirmation or visit your dashboard to see your upcoming sessions.'}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button asChild>
                <Link href="/dashboard/my-sessions">View My Sessions</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/coaches/${slug}`}>
                  <User className="mr-2 h-4 w-4" />
                  View Coach Profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get client's timezone for display (use coach timezone as fallback)
  const displayTimezone = booking.coachTimezone;

  // Success state
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--brand-accent-light))]">
            <CheckCircle className="h-8 w-8 text-[hsl(var(--brand-warm))]" />
          </div>
          <CardTitle className="text-2xl">Booking Request Submitted!</CardTitle>
          <CardDescription>
            Your payment is confirmed. Your session with {booking.coachName} is now awaiting coach
            approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Payment confirmation */}
          <div className="rounded-lg border border-[hsl(var(--brand-border))] bg-[hsl(var(--brand-surface))] p-4 text-[hsl(var(--brand-accent-dark))] dark:border-[hsl(var(--brand-accent-darker))] dark:bg-[hsl(var(--brand-accent-deep))] dark:text-[hsl(var(--brand-border))]">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">
                Payment of {currencySymbol}
                {formatPrice(booking.amountPaid)} {booking.currency} confirmed
              </span>
            </div>
          </div>

          {/* Pending approval notice */}
          <div className="rounded-lg border border-gold/30 bg-gold/10 p-4 text-gold-dark">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">
                Awaiting coach approval — your coach will confirm the session shortly.
              </span>
            </div>
          </div>

          {/* Intake form prompt */}
          {intake && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                {intake.submitted ? (
                  <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                )}
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">
                    {intake.submitted ? 'Intake submitted' : 'One more step — complete your intake'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {intake.submitted
                      ? 'Your coach has received your intake answers and will review them before your session.'
                      : 'Your coach would like you to fill out a short intake form so they can make the most of your session.'}
                  </p>
                  {!intake.submitted && (
                    <Button asChild size="sm">
                      <Link href={intake.intakeUrl}>Start intake</Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Booking Details */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="mb-4 font-semibold">Session Details</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={booking.coachAvatarUrl || undefined} alt={booking.coachName} />
                  <AvatarFallback>{getInitials(booking.coachName)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{booking.coachName}</p>
                  <p className="text-sm text-muted-foreground">Coach</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatDateLong(booking.startTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {formatTimeInTz(booking.startTime, displayTimezone)} -{' '}
                    {formatTimeInTz(booking.endTime, displayTimezone)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4" />
                <span>Timezone: {displayTimezone}</span>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{booking.sessionType.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.sessionType.duration} minutes
                  </p>
                </div>
                <Badge variant="secondary" className="text-base">
                  {currencySymbol}
                  {formatPrice(booking.sessionType.price)}
                </Badge>
              </div>

              {booking.clientNotes && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1 text-sm font-medium">Your Notes:</p>
                    <p className="text-sm text-muted-foreground">{booking.clientNotes}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Confirmation number */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Booking Reference</p>
            <p className="font-mono text-lg font-semibold">#{booking.id}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button onClick={handleAddToCalendar} disabled={isDownloadingIcs} className="w-full">
              {isDownloadingIcs ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarPlus className="mr-2 h-4 w-4" />
              )}
              Add to Calendar
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/coaches/${booking.coachSlug}`}>
                <User className="mr-2 h-4 w-4" />
                View Coach Profile
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/dashboard/my-sessions">Go to My Sessions</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
