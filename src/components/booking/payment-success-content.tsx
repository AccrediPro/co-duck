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
  Clock,
  Globe,
  Loader2,
  User,
} from 'lucide-react';

interface PaymentSuccessContentProps {
  coach: CoachBookingData;
  slug: string;
  booking?: BookingSuccessData;
  error?: string;
}

export function PaymentSuccessContent({ coach, slug, booking, error }: PaymentSuccessContentProps) {
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
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-2xl">Payment Processing</CardTitle>
            <CardDescription>
              Your payment may have been successful, but we&apos;re still processing your booking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
          <CardDescription>
            Your coaching session with {booking.coachName} has been booked and paid.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Payment confirmation */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">
                Payment of {currencySymbol}
                {formatPrice(booking.amountPaid)} {booking.currency} confirmed
              </span>
            </div>
          </div>

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
                  <span className="text-sm">{formatDate(booking.startTime, displayTimezone)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {formatTime(booking.startTime, displayTimezone)} -{' '}
                    {formatTime(booking.endTime, displayTimezone)}
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
