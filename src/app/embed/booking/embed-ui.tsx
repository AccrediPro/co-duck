'use client';

/**
 * Compact single-view booking flow rendered inside an iframe.
 *
 * Design goals:
 * - No site chrome (no nav, no footer) — we own the whole viewport.
 * - Stacks vertically: session → calendar → slots → guest details → submit.
 * - Reports height to the parent via postMessage(resize) on every layout
 *   change so the host iframe auto-grows to fit content.
 * - Payment: calls `createEmbedCheckoutSession` server action which creates
 *   a pending booking + Stripe Checkout URL; we then tell the parent to
 *   break out of the iframe and redirect its top window to Stripe.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Globe, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SUPPORTED_CURRENCIES } from '@/lib/validators/coach-onboarding';
import { TIMEZONES, getDetectedTimezone } from '@/lib/timezones';
import { formatDateLong } from '@/lib/date-utils';
import type { SessionType } from '@/db/schema';
import {
  getAvailableSlots,
  getBookableDates,
  type CoachBookingData,
  type TimeSlot,
} from '@/app/(public)/coaches/[slug]/book/actions';
import { createEmbedCheckoutSession } from './actions';

interface EmbedBookingUiProps {
  coach: CoachBookingData;
  slug: string;
  preselectedSessionId: string | null;
  theme: 'light' | 'dark';
  accent: string | null;
  parentOrigin: string | null;
}

function formatDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function EmbedBookingUi({
  coach,
  slug,
  preselectedSessionId,
  theme,
  accent,
  parentOrigin,
}: EmbedBookingUiProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // ── Selection state ────────────────────────────────────────────────────────
  const initialSession =
    coach.sessionTypes.find((s) => s.id === preselectedSessionId) ??
    (coach.sessionTypes.length === 1 ? coach.sessionTypes[0] : null);

  const [selectedSession, setSelectedSession] = useState<SessionType | null>(initialSession);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [clientTimezone, setClientTimezone] = useState<string>('America/New_York');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // ── Async data ─────────────────────────────────────────────────────────────
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [bookableDates, setBookableDates] = useState<Set<string>>(new Set());
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isLoadingDates, setIsLoadingDates] = useState(false);

  // ── Guest details ──────────────────────────────────────────────────────────
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Currency formatting ────────────────────────────────────────────────────
  const currencySymbol = SUPPORTED_CURRENCIES.find((c) => c.code === coach.currency)?.symbol ?? '$';
  const formatPrice = (cents: number) => (cents / 100).toFixed(2);

  // ── Theme + accent injection ───────────────────────────────────────────────
  const accentStyle: React.CSSProperties | undefined = accent
    ? ({ ['--primary-override']: accent } as React.CSSProperties)
    : undefined;

  // ── Timezone detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const detected = getDetectedTimezone();
    const match = TIMEZONES.find((tz) => tz.value === detected);
    setClientTimezone(match ? detected : 'America/New_York');
  }, []);

  // ── postMessage: tell parent we're ready + sync height ─────────────────────
  const postToParent = useCallback(
    (payload: Record<string, unknown>) => {
      if (typeof window === 'undefined' || window.parent === window) return;
      try {
        const target = parentOrigin && parentOrigin !== 'null' ? parentOrigin : '*';
        window.parent.postMessage({ source: 'coachhub', ...payload }, target);
      } catch {
        // Cross-origin frame posting can throw in pathological cases; ignore.
      }
    },
    [parentOrigin]
  );

  useEffect(() => {
    postToParent({ type: 'ready' });
  }, [postToParent]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.ceil(entry.contentRect.height);
        postToParent({ type: 'resize', height: h });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [postToParent]);

  // ── Fetch bookable dates when month changes / session selected ─────────────
  const fetchBookableDates = useCallback(
    async (month: Date) => {
      setIsLoadingDates(true);
      const result = await getBookableDates(coach.userId, month.getMonth(), month.getFullYear());
      if (result.success) setBookableDates(new Set(result.data));
      setIsLoadingDates(false);
    },
    [coach.userId]
  );

  useEffect(() => {
    if (selectedSession) fetchBookableDates(currentMonth);
  }, [selectedSession, currentMonth, fetchBookableDates]);

  // ── Fetch slots when date is selected ──────────────────────────────────────
  useEffect(() => {
    if (!selectedDate || !selectedSession) return;
    let cancelled = false;
    setIsLoadingSlots(true);
    setSelectedSlot(null);
    getAvailableSlots(
      coach.userId,
      formatDateString(selectedDate),
      selectedSession.duration,
      coach.timezone,
      clientTimezone
    ).then((result) => {
      if (cancelled) return;
      setAvailableSlots(result.success ? result.data : []);
      setIsLoadingSlots(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedSession, clientTimezone, coach.userId, coach.timezone]);

  // ── Submit handler ─────────────────────────────────────────────────────────
  const canSubmit =
    !!selectedSession &&
    !!selectedSlot &&
    guestName.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail) &&
    !submitting;

  const handleSubmit = async () => {
    if (!selectedSession || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);

    const result = await createEmbedCheckoutSession({
      coachSlug: slug,
      sessionTypeId: selectedSession.id,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      clientTimezone,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim(),
      clientNotes: clientNotes.trim() || undefined,
    });

    if (!result.success) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    // Free sessions: skip Stripe, send success page.
    const redirectUrl = result.checkoutUrl;
    postToParent({ type: 'redirect', url: redirectUrl, target: '_top' });

    // Fallback in case the parent never reacts (e.g. widget loaded standalone
    // at /embed/booking in a tab).
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.parent === window) {
        window.location.href = redirectUrl;
      }
    }, 400);
  };

  const isDateBookable = (date: Date) => bookableDates.has(formatDateString(date));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={rootRef}
      data-theme={theme}
      className={theme === 'dark' ? 'dark' : ''}
      style={accentStyle}
    >
      <style jsx global>{`
        .embed-accent :is([data-slot='button'][data-variant='default'], .bg-primary) {
          ${accent
            ? `background-color: var(--primary-override, hsl(var(--primary))) !important;`
            : ''}
        }
      `}</style>

      <div className="embed-accent mx-auto w-full max-w-xl bg-background p-4 text-foreground sm:p-6">
        {/* Coach header */}
        <div className="mb-5 flex items-center gap-3">
          {coach.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coach.avatarUrl}
              alt={coach.name}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              {coach.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{coach.name}</p>
            {coach.headline && (
              <p className="truncate text-xs text-muted-foreground">{coach.headline}</p>
            )}
          </div>
        </div>

        {/* Step 1 — session type */}
        <section className="mb-5">
          <h3 className="mb-2 text-sm font-medium">Choose a session</h3>
          <div className="grid gap-2">
            {coach.sessionTypes.map((session) => {
              const active = selectedSession?.id === session.id;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    setSelectedSession(session);
                    setSelectedDate(undefined);
                    setSelectedSlot(null);
                  }}
                  className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    active
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/60 hover:bg-accent/30'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{session.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {session.duration} min
                    </p>
                  </div>
                  <div className="pl-3 text-right">
                    <p className="text-sm font-semibold">
                      {currencySymbol}
                      {formatPrice(session.price)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {coach.currency}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2 — date + time */}
        {selectedSession && (
          <section className="mb-5 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium">Pick a date</h3>
              {isLoadingDates ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(d) => !isDateBookable(d)}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  className="rounded-md border"
                />
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Pick a time</h3>
              <div className="mb-3">
                <Select value={clientTimezone} onValueChange={setClientTimezone}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Timezone" />
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

              {!selectedDate ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Choose a date to see available times.
                </p>
              ) : isLoadingSlots ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-9" />
                  ))}
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-4 text-center">
                  <CalendarIcon className="mx-auto mb-1 h-6 w-6 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground">No slots available.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.startTime}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                        selectedSlot?.startTime === slot.startTime
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:bg-accent/40'
                      }`}
                    >
                      {slot.displayTime}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Step 3 — guest details + submit */}
        {selectedSession && selectedSlot && (
          <section className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ch-embed-name">Your name</Label>
                <Input
                  id="ch-embed-name"
                  autoComplete="name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div>
                <Label htmlFor="ch-embed-email">Email</Label>
                <Input
                  id="ch-embed-email"
                  type="email"
                  autoComplete="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ch-embed-notes">Notes (optional)</Label>
              <Textarea
                id="ch-embed-notes"
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Anything you'd like your coach to know?"
                rows={3}
              />
            </div>

            <div className="rounded-md bg-muted/40 p-3 text-xs">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>{selectedDate ? formatDateLong(selectedDate) : ''}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {selectedSlot.displayTime} · {selectedSession.duration} min
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                <span className="truncate">
                  {TIMEZONES.find((t) => t.value === clientTimezone)?.label ?? clientTimezone}
                </span>
              </div>
            </div>

            {submitError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                {submitError}
              </p>
            )}

            <Button
              type="button"
              className="w-full"
              size="lg"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting to payment…
                </>
              ) : (
                <>
                  Book & pay {currencySymbol}
                  {formatPrice(selectedSession.price)}
                </>
              )}
            </Button>

            <p className="text-center text-[10px] text-muted-foreground">
              Secure payment via Stripe. You&apos;ll be redirected to complete checkout.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
