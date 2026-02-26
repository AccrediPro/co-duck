'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { SUPPORTED_CURRENCIES } from '@/lib/validators/coach-onboarding';
import type { SessionType } from '@/db/schema';
import type { CoachBookingData } from '@/app/(public)/coaches/[slug]/book/actions';
import {
  createBooking,
  createCheckoutSession,
  generateIcsFile,
  type BookingResult,
} from '@/app/(public)/coaches/[slug]/book/confirm/actions';
import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Check,
  Clock,
  CreditCard,
  DollarSign,
  Globe,
  Loader2,
  User,
} from 'lucide-react';

interface BookingConfirmationProps {
  coach: CoachBookingData;
  slug: string;
  sessionType: SessionType;
  startTime: string;
  endTime: string;
  clientTimezone: string;
  isAuthenticated: boolean;
  returnUrl: string;
}

export function BookingConfirmation({
  coach,
  slug,
  sessionType,
  startTime,
  endTime,
  clientTimezone,
  isAuthenticated,
  returnUrl,
}: BookingConfirmationProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [clientNotes, setClientNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [isDownloadingIcs, setIsDownloadingIcs] = useState(false);

  // Parse dates
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

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

  // Format date for display
  const formatDate = (date: Date, tz: string) => {
    try {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: tz,
      });
    } catch {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  // Format time for display
  const formatTime = (date: Date, tz: string) => {
    try {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: tz,
      });
    } catch {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  };

  // Check if this is a paid session
  const isPaidSession = sessionType.price > 0;

  // Handle booking confirmation
  const handleConfirmBooking = async () => {
    if (!isAuthenticated) {
      // Redirect to sign-in with return URL
      router.push(`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsSubmitting(true);

    if (isPaidSession) {
      // For paid sessions, create a Stripe Checkout session
      const result = await createCheckoutSession({
        coachId: coach.userId,
        coachSlug: slug,
        sessionType: {
          name: sessionType.name,
          duration: sessionType.duration,
          price: sessionType.price,
        },
        startTime,
        endTime,
        clientNotes: clientNotes.trim() || undefined,
        clientTimezone,
      });

      setIsSubmitting(false);

      if (result.success) {
        // Redirect to Stripe Checkout
        window.location.href = result.checkoutUrl;
      } else {
        toast({
          title: 'Payment Setup Failed',
          description: result.error,
          variant: 'destructive',
        });
      }
    } else {
      // For free sessions, create booking directly with confirmed status
      const result = await createBooking({
        coachId: coach.userId,
        sessionType: {
          name: sessionType.name,
          duration: sessionType.duration,
          price: sessionType.price,
        },
        startTime,
        endTime,
        clientNotes: clientNotes.trim() || undefined,
      });

      setIsSubmitting(false);

      if (result.success) {
        setBookingResult(result.data);
        setBookingComplete(true);
        toast({
          title: 'Booking Request Submitted!',
          description: 'Your session request is awaiting coach approval.',
        });
      } else {
        toast({
          title: 'Booking Failed',
          description: result.error,
          variant: 'destructive',
        });
      }
    }
  };

  // Handle calendar download
  const handleAddToCalendar = async () => {
    if (!bookingResult) return;

    setIsDownloadingIcs(true);

    const result = await generateIcsFile(bookingResult.id);

    setIsDownloadingIcs(false);

    if (result.success) {
      // Create and trigger download
      const blob = new Blob([result.data], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `coaching-session-${bookingResult.id}.ics`;
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

  // Success state
  if (bookingComplete && bookingResult) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Booking Request Submitted!</CardTitle>
            <CardDescription>
              Your session request with {bookingResult.coachName} is now awaiting coach approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Pending approval notice */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Awaiting coach approval — your coach will confirm the session shortly.
                </span>
              </div>
            </div>

            {/* Booking Details */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="mb-4 font-semibold">Session Details</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={bookingResult.coachAvatarUrl || undefined}
                      alt={bookingResult.coachName}
                    />
                    <AvatarFallback>{getInitials(bookingResult.coachName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{bookingResult.coachName}</p>
                    <p className="text-sm text-muted-foreground">Coach</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {formatDate(bookingResult.startTime, clientTimezone)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {formatTime(bookingResult.startTime, clientTimezone)} -{' '}
                      {formatTime(bookingResult.endTime, clientTimezone)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span>Your timezone: {clientTimezone}</span>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{bookingResult.sessionType.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {bookingResult.sessionType.duration} minutes
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-base">
                    {currencySymbol}
                    {formatPrice(bookingResult.sessionType.price)}
                  </Badge>
                </div>

                {bookingResult.clientNotes && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-1 text-sm font-medium">Your Notes:</p>
                      <p className="text-sm text-muted-foreground">{bookingResult.clientNotes}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Confirmation number */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Booking Reference</p>
              <p className="font-mono text-lg font-semibold">#{bookingResult.id}</p>
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
                <Link href={`/coaches/${bookingResult.coachSlug}`}>
                  <User className="mr-2 h-4 w-4" />
                  View Coach Profile
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirmation form
  return (
    <div className="mx-auto max-w-2xl">
      {/* Back button */}
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link href={`/coaches/${slug}/book`}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Time Selection
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Confirm Your Booking</CardTitle>
          <CardDescription>Review your session details and complete your booking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Coach Info */}
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={coach.avatarUrl || undefined} alt={coach.name} />
              <AvatarFallback>
                {coach.name ? getInitials(coach.name) : <User className="h-6 w-6" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{coach.name}</h3>
              {coach.headline && <p className="text-sm text-muted-foreground">{coach.headline}</p>}
            </div>
          </div>

          <Separator />

          {/* Session Details */}
          <div className="space-y-4">
            <h4 className="font-medium">Session Details</h4>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{sessionType.name}</p>
                  <p className="text-sm text-muted-foreground">{sessionType.duration} minutes</p>
                </div>
                <Badge variant="secondary" className="text-base">
                  {currencySymbol}
                  {formatPrice(sessionType.price)}
                </Badge>
              </div>

              <Separator />

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatDate(startDate, clientTimezone)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {formatTime(startDate, clientTimezone)} - {formatTime(endDate, clientTimezone)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4" />
                <span>Your timezone: {clientTimezone}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Notes field */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes for your coach (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Share anything you'd like your coach to know before the session..."
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              rows={3}
              maxLength={1000}
            />
            <p className="text-right text-xs text-muted-foreground">
              {clientNotes.length}/1000 characters
            </p>
          </div>

          <Separator />

          {/* Price Summary */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Total</span>
            </div>
            <span className="text-xl font-bold">
              {currencySymbol}
              {formatPrice(sessionType.price)} {coach.currency}
            </span>
          </div>

          {/* Auth warning */}
          {!isAuthenticated && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <p className="text-sm">
                You&apos;ll need to sign in to complete your booking. Don&apos;t worry - you&apos;ll
                be brought right back here after signing in.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full"
              onClick={handleConfirmBooking}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isPaidSession ? 'Redirecting to Payment...' : 'Confirming...'}
                </>
              ) : isAuthenticated ? (
                isPaidSession ? (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay Now
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirm Booking
                  </>
                )
              ) : (
                `Sign in to ${isPaidSession ? 'Pay & Book' : 'Confirm Booking'}`
              )}
            </Button>
            <Button variant="ghost" asChild>
              <Link href={`/coaches/${slug}`}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
