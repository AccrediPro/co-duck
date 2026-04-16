'use client';

/**
 * @fileoverview Client-side list of the signed-in user's memberships.
 *
 * Renders one card per subscription with:
 * - Coach name + link to profile
 * - Membership tier + price
 * - Sessions remaining this period
 * - Period end date
 * - Cancel button (end-of-period by default)
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CalendarCheck, Repeat, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Subscription {
  id: number;
  status: 'active' | 'past_due' | 'canceled' | 'incomplete';
  sessionsRemainingThisPeriod: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  membership: {
    id: number;
    name: string;
    description: string | null;
    monthlyPriceCents: number;
    currency: string;
    sessionsPerPeriod: number;
    includesMessaging: boolean;
  };
  coach: {
    id: string;
    name: string | null;
    slug: string | null;
    avatarUrl: string | null;
  };
}

interface Props {
  subscriptions: Subscription[];
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function statusBadge(sub: Subscription) {
  if (sub.status === 'canceled') return <Badge variant="secondary">Ended</Badge>;
  if (sub.status === 'past_due') return <Badge variant="destructive">Payment failed</Badge>;
  if (sub.status === 'incomplete') return <Badge variant="secondary">Setting up</Badge>;
  if (sub.cancelAtPeriodEnd) return <Badge variant="outline">Ending soon</Badge>;
  return <Badge>Active</Badge>;
}

export function MyMembershipsList({ subscriptions }: Props) {
  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          You don’t have any memberships yet. Browse coaches to find an ongoing program.
          <div className="mt-4">
            <Button asChild>
              <Link href="/coaches">Find a coach</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {subscriptions.map((sub) => (
        <SubscriptionCard key={sub.id} sub={sub} />
      ))}
    </div>
  );
}

function SubscriptionCard({ sub }: { sub: Subscription }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const coachName = sub.coach.name || 'Your coach';
  const canCancel = sub.status === 'active' || sub.status === 'past_due';
  const endingSoon = sub.cancelAtPeriodEnd && sub.status !== 'canceled';

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/memberships/subscriptions/${sub.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          immediate: false,
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || 'Failed to cancel');
      }
      toast({
        title: 'Membership scheduled to end',
        description: `You'll retain access until ${formatDate(sub.currentPeriodEnd)}.`,
      });
      setCancelOpen(false);
      setReason('');
      startTransition(() => router.refresh());
    } catch (err) {
      toast({
        title: 'Could not cancel',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg">{sub.membership.name}</CardTitle>
            <CardDescription>
              with{' '}
              {sub.coach.slug ? (
                <Link href={`/coaches/${sub.coach.slug}`} className="font-medium hover:underline">
                  {coachName}
                </Link>
              ) : (
                <span className="font-medium">{coachName}</span>
              )}
            </CardDescription>
          </div>
          {statusBadge(sub)}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">
            {formatMoney(sub.membership.monthlyPriceCents, sub.membership.currency)}
          </span>
          <span className="text-sm text-muted-foreground">/month</span>
        </div>

        <ul className="space-y-1.5 text-sm">
          <li className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            {sub.membership.sessionsPerPeriod > 0 ? (
              <>
                <span className="font-medium">{sub.sessionsRemainingThisPeriod}</span>
                &nbsp;of {sub.membership.sessionsPerPeriod} session
                {sub.membership.sessionsPerPeriod === 1 ? '' : 's'} remaining this period
              </>
            ) : (
              'Messaging-only tier'
            )}
          </li>
          {sub.membership.includesMessaging && (
            <li className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Unlimited messaging
            </li>
          )}
          <li className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            {sub.status === 'canceled'
              ? `Ended ${formatDate(sub.canceledAt ?? sub.currentPeriodEnd)}`
              : endingSoon
                ? `Access ends ${formatDate(sub.currentPeriodEnd)}`
                : `Renews ${formatDate(sub.currentPeriodEnd)}`}
          </li>
        </ul>

        {sub.status === 'past_due' && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            We couldn’t collect your last payment. Access will end soon if it isn’t resolved —
            please update your payment method in Stripe.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          {sub.membership.sessionsPerPeriod > 0 &&
            sub.sessionsRemainingThisPeriod > 0 &&
            (sub.status === 'active' || sub.status === 'past_due') &&
            sub.coach.slug && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/coaches/${sub.coach.slug}/book?subscriptionId=${sub.id}`}>
                  Redeem a session
                </Link>
              </Button>
            )}

          {canCancel && !sub.cancelAtPeriodEnd && (
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isPending}>
                  Cancel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel this membership?</DialogTitle>
                  <DialogDescription>
                    You’ll keep access until {formatDate(sub.currentPeriodEnd)}. After that, no
                    further charges will be made.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="cancel-reason">Reason (optional)</Label>
                  <Textarea
                    id="cancel-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Let your coach know why — it helps them improve."
                    rows={3}
                    maxLength={500}
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost" disabled={submitting}>
                      Keep subscription
                    </Button>
                  </DialogClose>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cancelling…
                      </>
                    ) : (
                      'Cancel at period end'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
