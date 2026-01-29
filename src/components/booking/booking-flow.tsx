'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { SUPPORTED_CURRENCIES } from '@/lib/validators/coach-onboarding';
import { TIMEZONES, getDetectedTimezone } from '@/lib/timezones';
import type { SessionType } from '@/db/schema';
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Globe,
  User,
} from 'lucide-react';
import {
  getAvailableSlots,
  getBookableDates,
  type CoachBookingData,
  type TimeSlot,
} from '@/app/(public)/coaches/[slug]/book/actions';

interface BookingFlowProps {
  coach: CoachBookingData;
  slug: string;
}

type BookingStep = 'session' | 'date' | 'time';

export function BookingFlow({ coach, slug }: BookingFlowProps) {
  const router = useRouter();

  // State
  const [currentStep, setCurrentStep] = useState<BookingStep>('session');
  const [selectedSession, setSelectedSession] = useState<SessionType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [clientTimezone, setClientTimezone] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [bookableDates, setBookableDates] = useState<Set<string>>(new Set());
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isLoadingDates, setIsLoadingDates] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Detect timezone on mount
  useEffect(() => {
    const detected = getDetectedTimezone();
    // Use detected timezone if it's in our list, otherwise use America/New_York
    const validTimezone = TIMEZONES.find((tz) => tz.value === detected);
    setClientTimezone(validTimezone ? detected : 'America/New_York');
  }, []);

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

  // Fetch bookable dates when month changes
  const fetchBookableDates = useCallback(
    async (month: Date) => {
      setIsLoadingDates(true);
      const result = await getBookableDates(coach.userId, month.getMonth(), month.getFullYear());
      if (result.success) {
        setBookableDates(new Set(result.data));
      }
      setIsLoadingDates(false);
    },
    [coach.userId]
  );

  useEffect(() => {
    if (currentStep === 'date' && selectedSession) {
      fetchBookableDates(currentMonth);
    }
  }, [currentStep, selectedSession, currentMonth, fetchBookableDates]);

  // Fetch available slots when date is selected
  useEffect(() => {
    if (selectedDate && selectedSession && clientTimezone) {
      const fetchSlots = async () => {
        setIsLoadingSlots(true);
        setSelectedSlot(null);
        const dateStr = formatDateString(selectedDate);
        const result = await getAvailableSlots(
          coach.userId,
          dateStr,
          selectedSession.duration,
          coach.timezone,
          clientTimezone
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
  }, [selectedDate, selectedSession, clientTimezone, coach.userId, coach.timezone]);

  // Helper to format date as YYYY-MM-DD
  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Handle session selection
  const handleSelectSession = (session: SessionType) => {
    setSelectedSession(session);
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setCurrentStep('date');
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

  // Handle continue to confirmation
  const handleContinue = () => {
    if (selectedSession && selectedDate && selectedSlot) {
      // Navigate to confirmation page with booking details
      const params = new URLSearchParams({
        sessionId: selectedSession.id,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        timezone: clientTimezone,
      });
      router.push(`/coaches/${slug}/book/confirm?${params.toString()}`);
    }
  };

  // Go back to previous step
  const handleBack = () => {
    if (currentStep === 'time') {
      setCurrentStep('date');
      setSelectedSlot(null);
    } else if (currentStep === 'date') {
      setCurrentStep('session');
      setSelectedDate(undefined);
      setSelectedSlot(null);
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
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
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
            <AvatarImage src={coach.avatarUrl || undefined} alt={coach.name} />
            <AvatarFallback>
              {coach.name ? getInitials(coach.name) : <User className="h-6 w-6" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{coach.name}</h2>
            {coach.headline && <p className="text-sm text-muted-foreground">{coach.headline}</p>}
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              Coach&apos;s timezone: {coach.timezone}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/coaches/${slug}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Profile
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            currentStep === 'session'
              ? 'bg-primary text-primary-foreground'
              : 'bg-primary/20 text-primary'
          }`}
        >
          {currentStep !== 'session' ? <Check className="h-4 w-4" /> : '1'}
        </div>
        <div className="h-0.5 w-12 bg-muted" />
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            currentStep === 'date'
              ? 'bg-primary text-primary-foreground'
              : currentStep === 'time'
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {currentStep === 'time' ? <Check className="h-4 w-4" /> : '2'}
        </div>
        <div className="h-0.5 w-12 bg-muted" />
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            currentStep === 'time'
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
          {/* Step 1: Select Session Type */}
          {currentStep === 'session' && (
            <Card>
              <CardHeader>
                <CardTitle>Select Session Type</CardTitle>
                <CardDescription>
                  Choose the type of coaching session you&apos;d like
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {coach.sessionTypes.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleSelectSession(session)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent/50 ${
                      selectedSession?.id === session.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{session.name}</h4>
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {session.duration} minutes
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">
                          {currencySymbol}
                          {formatPrice(session.price)}
                        </p>
                        <p className="text-xs text-muted-foreground">{coach.currency}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select Date */}
          {currentStep === 'date' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Select Date</CardTitle>
                    <CardDescription>Choose an available date for your session</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleBack}>
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                </div>
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

          {/* Step 3: Select Time */}
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
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50 ${
                          selectedSlot?.startTime === slot.startTime
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border'
                        }`}
                      >
                        {slot.displayTime}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Booking Summary */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base">Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selected Session */}
              {selectedSession ? (
                <div className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{selectedSession.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedSession.duration} minutes
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {currencySymbol}
                      {formatPrice(selectedSession.price)}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No session selected</p>
              )}

              {/* Selected Date & Time */}
              {selectedDate && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{formatSelectedDate(selectedDate)}</span>
                  </div>
                  {selectedSlot && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
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
              )}

              {/* Continue Button */}
              <Button
                className="w-full"
                size="lg"
                disabled={!selectedSession || !selectedDate || !selectedSlot}
                onClick={handleContinue}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
