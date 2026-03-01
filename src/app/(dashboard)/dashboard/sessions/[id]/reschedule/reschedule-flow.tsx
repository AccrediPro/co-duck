'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDateLong, formatDate, formatTimeInTz } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { SUPPORTED_CURRENCIES } from '@/lib/validators/coach-onboarding';
import { TIMEZONES, getDetectedTimezone } from '@/lib/timezones';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Globe,
  Loader2,
  User,
  RefreshCw,
} from 'lucide-react';
import {
  getRescheduleAvailableSlots,
  getRescheduleBookableDates,
  confirmReschedule,
  type RescheduleBookingData,
  type TimeSlot,
} from './actions';

interface RescheduleFlowProps {
  booking: RescheduleBookingData;
}

type RescheduleStep = 'date' | 'time' | 'confirm';

export function RescheduleFlow({ booking }: RescheduleFlowProps) {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [currentStep, setCurrentStep] = useState<RescheduleStep>('date');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [clientTimezone, setClientTimezone] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [bookableDates, setBookableDates] = useState<Set<string>>(new Set());
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isLoadingDates, setIsLoadingDates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Detect timezone on mount
  useEffect(() => {
    const detected = getDetectedTimezone();
    const validTimezone = TIMEZONES.find((tz) => tz.value === detected);
    setClientTimezone(validTimezone ? detected : 'America/New_York');
  }, []);

  // Currency formatting
  const currencyData = SUPPORTED_CURRENCIES.find((c) => c.code === booking.coachCurrency);
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

  // Fetch bookable dates when month changes
  const fetchBookableDates = useCallback(
    async (month: Date) => {
      setIsLoadingDates(true);
      const result = await getRescheduleBookableDates(
        booking.coachId,
        booking.id,
        month.getMonth(),
        month.getFullYear()
      );
      if (result.success) {
        setBookableDates(new Set(result.data));
      }
      setIsLoadingDates(false);
    },
    [booking.coachId, booking.id]
  );

  useEffect(() => {
    fetchBookableDates(currentMonth);
  }, [currentMonth, fetchBookableDates]);

  // Fetch available slots when date is selected
  useEffect(() => {
    if (selectedDate && clientTimezone) {
      const fetchSlots = async () => {
        setIsLoadingSlots(true);
        setSelectedSlot(null);
        const dateStr = formatDateString(selectedDate);
        const result = await getRescheduleAvailableSlots(
          booking.coachId,
          booking.id,
          dateStr,
          booking.sessionType.duration,
          booking.coachTimezone,
          clientTimezone,
          booking.originalStartTime
        );
        if (result.success) {
          setAvailableSlots(result.data);
        } else {
          setAvailableSlots([]);
        }
        setIsLoadingSlots(false);
      };
      fetchSlots();
    }
  }, [
    selectedDate,
    clientTimezone,
    booking.coachId,
    booking.id,
    booking.sessionType.duration,
    booking.coachTimezone,
    booking.originalStartTime,
  ]);

  // Helper to format date as YYYY-MM-DD
  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Handle date selection
  const handleSelectDate = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (date) {
      setCurrentStep('time');
    }
  };

  // Handle slot selection
  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
  };

  // Go back to previous step
  const handleBack = () => {
    if (currentStep === 'confirm') {
      setCurrentStep('time');
    } else if (currentStep === 'time') {
      setCurrentStep('date');
      setSelectedSlot(null);
    }
  };

  // Proceed to confirmation
  const handleProceedToConfirm = () => {
    if (selectedSlot) {
      setCurrentStep('confirm');
    }
  };

  // Handle confirm reschedule
  const handleConfirmReschedule = async () => {
    if (!selectedSlot) return;

    setIsSubmitting(true);

    const result = await confirmReschedule(
      booking.id,
      selectedSlot.startTime,
      selectedSlot.endTime
    );

    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: 'Session Rescheduled',
        description: 'Your coaching session has been rescheduled successfully.',
      });
      router.push(`/dashboard/sessions/${booking.id}`);
      router.refresh();
    } else {
      toast({
        title: 'Reschedule Failed',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  // Check if a date is bookable
  const isDateBookable = (date: Date) => {
    const dateStr = formatDateString(date);
    return bookableDates.has(dateStr);
  };

  // Disable dates that are not bookable
  const isDateDisabled = (date: Date) => {
    return !isDateBookable(date);
  };

  // Format selected date for display
  const formatSelectedDate = (date: Date) => {
    return formatDateLong(date);
  };

  // Get timezone label
  const getTimezoneLabel = (tz: string) => {
    const found = TIMEZONES.find((t) => t.value === tz);
    return found ? found.label : tz;
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Coach Header */}
      <Card className="mb-6">
        <CardContent className="flex items-center gap-4 py-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={booking.coachAvatarUrl || undefined} alt={booking.coachName} />
            <AvatarFallback>
              {booking.coachName ? getInitials(booking.coachName) : <User className="h-6 w-6" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{booking.coachName}</h2>
            {booking.coachHeadline && (
              <p className="text-sm text-muted-foreground">{booking.coachHeadline}</p>
            )}
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              Coach&apos;s timezone: {booking.coachTimezone}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/sessions/${booking.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Session
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            currentStep === 'date'
              ? 'bg-primary text-primary-foreground'
              : 'bg-primary/20 text-primary'
          }`}
        >
          {currentStep !== 'date' ? <Check className="h-4 w-4" /> : '1'}
        </div>
        <div className="h-0.5 w-12 bg-muted" />
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            currentStep === 'time'
              ? 'bg-primary text-primary-foreground'
              : currentStep === 'confirm'
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {currentStep === 'confirm' ? <Check className="h-4 w-4" /> : '2'}
        </div>
        <div className="h-0.5 w-12 bg-muted" />
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            currentStep === 'confirm'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          3
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Step 1: Select Date */}
          {currentStep === 'date' && (
            <Card>
              <CardHeader>
                <CardTitle>Select New Date</CardTitle>
                <CardDescription>
                  Choose an available date for your rescheduled session
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDates ? (
                  <div className="flex justify-center py-8">
                    <Skeleton className="h-[300px] w-full max-w-[350px]" />
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleSelectDate}
                      disabled={isDateDisabled}
                      month={currentMonth}
                      onMonthChange={setCurrentMonth}
                      className="rounded-md border"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select Time */}
          {currentStep === 'time' && selectedDate && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Select Time</CardTitle>
                    <CardDescription>
                      Available times for {formatSelectedDate(selectedDate)}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleBack}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Timezone Selector */}
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium">Your timezone</label>
                  <Select value={clientTimezone} onValueChange={setClientTimezone}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Time Slots */}
                {isLoadingSlots ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton key={i} className="h-10" />
                    ))}
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="py-8 text-center">
                    <CalendarIcon className="mx-auto mb-2 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      No available times for this date. Please select another date.
                    </p>
                    <Button variant="outline" className="mt-4" onClick={handleBack}>
                      Choose Another Date
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.startTime}
                        onClick={() => handleSelectSlot(slot)}
                        className={`relative rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50 ${
                          selectedSlot?.startTime === slot.startTime
                            ? 'border-primary bg-primary text-primary-foreground'
                            : slot.isOriginalSlot
                              ? 'border-gold/50 bg-gold/5 text-burgundy-dark dark:border-gold-dark dark:bg-gold-dark/10 dark:text-gold'
                              : 'border-border'
                        }`}
                      >
                        {slot.displayTime}
                        {slot.isOriginalSlot && (
                          <span className="absolute -top-2 right-1 rounded bg-gold px-1 text-[10px] font-bold text-white">
                            Current
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Continue button */}
                {selectedSlot && (
                  <div className="mt-6 flex justify-end">
                    <Button onClick={handleProceedToConfirm}>Continue to Confirm</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Confirm */}
          {currentStep === 'confirm' && selectedDate && selectedSlot && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Confirm Reschedule</CardTitle>
                    <CardDescription>Review and confirm your new session time</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleBack}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Original booking */}
                <div>
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                    Current Booking
                  </h4>
                  <div className="rounded-lg border border-dashed bg-muted/30 p-4">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground line-through">
                        {formatDateLong(booking.originalStartTime)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground line-through">
                        {formatTimeInTz(new Date(booking.originalStartTime), clientTimezone)} -{' '}
                        {formatTimeInTz(new Date(booking.originalEndTime), clientTimezone)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="flex justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <RefreshCw className="h-5 w-5 text-primary" />
                  </div>
                </div>

                {/* New booking */}
                <div>
                  <h4 className="mb-2 text-sm font-medium text-primary">New Booking</h4>
                  <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                      <span className="font-medium">{formatSelectedDate(selectedDate)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {formatTimeInTz(new Date(selectedSlot.startTime), clientTimezone)} -{' '}
                        {formatTimeInTz(new Date(selectedSlot.endTime), clientTimezone)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      <span>Your timezone: {getTimezoneLabel(clientTimezone)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Session details */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{booking.sessionType.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.sessionType.duration} minutes
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {currencySymbol}
                      {formatPrice(booking.sessionType.price)}
                    </Badge>
                  </div>
                </div>

                {/* Confirm button */}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleConfirmReschedule}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rescheduling...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Confirm Reschedule
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base">Reschedule Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Session Info */}
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{booking.sessionType.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.sessionType.duration} minutes
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {currencySymbol}
                    {formatPrice(booking.sessionType.price)}
                  </Badge>
                </div>
              </div>

              {/* Current Booking */}
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Your Current Booking
                </p>
                <div className="rounded-lg border border-dashed bg-muted/30 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(booking.originalStartTime)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {formatTimeInTz(new Date(booking.originalStartTime), clientTimezone)} -{' '}
                      {formatTimeInTz(new Date(booking.originalEndTime), clientTimezone)}
                    </span>
                  </div>
                </div>
              </div>

              {/* New Date & Time */}
              {selectedDate && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-primary">New Time</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                      <span>{formatDate(selectedDate)}</span>
                    </div>
                    {selectedSlot && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>{selectedSlot.displayTime}</span>
                      </div>
                    )}
                    {clientTimezone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Globe className="h-4 w-4" />
                        <span className="line-clamp-1">{getTimezoneLabel(clientTimezone)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Policy notice */}
              <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 dark:border-gold-dark dark:bg-gold-dark/10">
                <p className="text-xs text-burgundy-dark dark:text-gold">
                  Reschedules must be made at least {booking.advanceNoticeHours} hours before the
                  session.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
