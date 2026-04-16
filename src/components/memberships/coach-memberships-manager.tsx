'use client';

/**
 * @fileoverview Coach-side memberships manager.
 *
 * Renders the list of memberships the coach owns plus an inline create form.
 * All mutations hit the `/api/memberships` API; we then refresh the page to
 * pull fresh server data (simple + robust — memberships aren't high-frequency).
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Repeat, Users, Power } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MembershipRow {
  id: number;
  name: string;
  description: string | null;
  monthlyPriceCents: number;
  currency: string;
  sessionsPerPeriod: number;
  includesMessaging: boolean;
  isActive: boolean;
  activeSubscribers: number;
  createdAt: string;
}

interface Props {
  initialMemberships: MembershipRow[];
  defaultCurrency: string;
}

function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function CoachMembershipsManager({ initialMemberships, defaultCurrency }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(initialMemberships.length === 0);

  // Form state (fresh create form).
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyPriceDollars, setMonthlyPriceDollars] = useState('');
  const [sessionsPerPeriod, setSessionsPerPeriod] = useState('2');
  const [includesMessaging, setIncludesMessaging] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setDescription('');
    setMonthlyPriceDollars('');
    setSessionsPerPeriod('2');
    setIncludesMessaging(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const priceDollars = Number.parseFloat(monthlyPriceDollars);
    if (!Number.isFinite(priceDollars) || priceDollars <= 0) {
      toast({
        title: 'Invalid price',
        description: 'Please enter a valid monthly price.',
        variant: 'destructive',
      });
      return;
    }

    const priceCents = Math.round(priceDollars * 100);
    const sessions = Number.parseInt(sessionsPerPeriod, 10);

    setSubmitting(true);
    try {
      const res = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          monthlyPriceCents: priceCents,
          currency: defaultCurrency,
          sessionsPerPeriod: Number.isFinite(sessions) ? sessions : 0,
          includesMessaging,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || 'Failed to create membership');
      }

      toast({
        title: 'Membership created',
        description: 'Clients can now subscribe from your public profile.',
      });

      resetForm();
      setShowForm(false);
      startTransition(() => router.refresh());
    } catch (err) {
      toast({
        title: 'Could not create membership',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = (m: MembershipRow) => {
    if (!m.isActive) {
      // Re-activate via PATCH — but API PATCH doesn't flip isActive explicitly;
      // the DELETE endpoint deactivates. Reactivation isn't exposed yet so we
      // nudge the user to create a new one.
      toast({
        title: 'Reactivation not supported',
        description: 'Create a new membership offering instead to keep pricing history clean.',
      });
      return;
    }

    if (m.activeSubscribers > 0) {
      const proceed = window.confirm(
        `This membership has ${m.activeSubscribers} active subscriber${
          m.activeSubscribers === 1 ? '' : 's'
        }. Deactivating hides it from new clients — existing subscribers keep access until they cancel. Continue?`
      );
      if (!proceed) return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/memberships/${m.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error?.message || 'Failed to deactivate');
        }
        toast({ title: 'Membership deactivated' });
        router.refresh();
      } catch (err) {
        toast({
          title: 'Could not deactivate',
          description: err instanceof Error ? err.message : 'Something went wrong',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Create a membership</CardTitle>
            <CardDescription>
              Clients pay this amount every month and receive the included sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="m-name">Membership name</Label>
                <Input
                  id="m-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Premium Coaching Membership"
                  maxLength={100}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="m-desc">Description (optional)</Label>
                <Textarea
                  id="m-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's included, expected outcomes, ideal client…"
                  rows={3}
                  maxLength={2000}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="m-price">Monthly price ({defaultCurrency.toUpperCase()})</Label>
                  <Input
                    id="m-price"
                    type="number"
                    step="0.01"
                    min="5"
                    value={monthlyPriceDollars}
                    onChange={(e) => setMonthlyPriceDollars(e.target.value)}
                    placeholder="400"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="m-sessions">Sessions per month</Label>
                  <Input
                    id="m-sessions"
                    type="number"
                    min="0"
                    max="60"
                    step="1"
                    value={sessionsPerPeriod}
                    onChange={(e) => setSessionsPerPeriod(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Include unlimited messaging</p>
                  <p className="text-xs text-muted-foreground">
                    Subscribers can message you any time during the billing period.
                  </p>
                </div>
                <Switch
                  checked={includesMessaging}
                  onCheckedChange={setIncludesMessaging}
                  aria-label="Include messaging"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                {initialMemberships.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      resetForm();
                      setShowForm(false);
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                )}
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
                    </>
                  ) : (
                    'Create membership'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> New membership
          </Button>
        </div>
      )}

      {/* Existing memberships */}
      {initialMemberships.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            You haven’t created any memberships yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {initialMemberships.map((m) => (
            <Card key={m.id} className={m.isActive ? '' : 'opacity-60'}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg">{m.name}</CardTitle>
                    {m.description && (
                      <CardDescription className="mt-1 line-clamp-3">
                        {m.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant={m.isActive ? 'default' : 'secondary'}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    {formatPrice(m.monthlyPriceCents, m.currency)}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>

                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    {m.sessionsPerPeriod > 0
                      ? `${m.sessionsPerPeriod} session${m.sessionsPerPeriod === 1 ? '' : 's'} per month`
                      : 'Messaging-only — no included sessions'}
                  </li>
                  {m.includesMessaging && (
                    <li className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Unlimited messaging
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {m.activeSubscribers} active subscriber
                    {m.activeSubscribers === 1 ? '' : 's'}
                  </li>
                </ul>

                <div className="flex items-center justify-end pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(m)}
                    disabled={isPending || !m.isActive}
                    title={m.isActive ? 'Deactivate this membership' : 'Inactive'}
                  >
                    <Power className="mr-2 h-4 w-4" />
                    {m.isActive ? 'Deactivate' : 'Inactive'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
