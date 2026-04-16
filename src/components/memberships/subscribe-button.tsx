'use client';

/**
 * @fileoverview Subscribe button for the coach profile page.
 *
 * Calls `POST /api/memberships/[id]/subscribe` and redirects the user to
 * the returned Stripe Checkout URL. Handles common UX states:
 *
 * - Signed-out viewers are sent to `/sign-in` with a redirect back to the
 *   profile page.
 * - Coaches looking at their own profile see the button disabled.
 * - Viewers who already have an active/past_due subscription see a link
 *   to their subscription management page instead.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Props {
  membershipId: number;
  coachId: string;
  currentUserId: string | null;
  alreadySubscribed: boolean;
}

export function SubscribeButton({
  membershipId,
  coachId,
  currentUserId,
  alreadySubscribed,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Signed-out viewer: link to sign-in. Clerk will bounce them back to
  // the page they started on via the default `afterSignInUrl`.
  if (!currentUserId) {
    return (
      <Button asChild size="sm">
        <Link href="/sign-in">Sign in to subscribe</Link>
      </Button>
    );
  }

  // Coaches can't subscribe to their own offering.
  if (currentUserId === coachId) {
    return (
      <Button size="sm" disabled>
        Your membership
      </Button>
    );
  }

  if (alreadySubscribed) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard/my-memberships">Manage subscription</Link>
      </Button>
    );
  }

  const startCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/memberships/${membershipId}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || 'Failed to start checkout');
      }
      if (data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (err) {
      toast({
        title: 'Could not start checkout',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <Button size="sm" onClick={startCheckout} disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…
        </>
      ) : (
        'Subscribe'
      )}
    </Button>
  );
}
