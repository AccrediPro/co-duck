'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface CoachVerifyActionsProps {
  coachId: string;
  currentStatus: 'pending' | 'verified' | 'rejected';
}

export function CoachVerifyActions({ coachId, currentStatus }: CoachVerifyActionsProps) {
  const router = useRouter();
  const [notes, setNotes] = React.useState('');
  const [isLoading, setIsLoading] = React.useState<'verified' | 'rejected' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function handleAction(status: 'verified' | 'rejected') {
    setIsLoading(status);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/coaches/${coachId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: notes || undefined }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Failed to update verification status');
        return;
      }

      setSuccess(status === 'verified' ? 'Coach has been approved.' : 'Coach has been rejected.');
      setNotes('');
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Current Status:</span>
        <VerificationBadge status={currentStatus} />
      </div>

      <div className="space-y-2">
        <label htmlFor="admin-notes" className="text-sm font-medium">
          Admin Notes (optional)
        </label>
        <Textarea
          id="admin-notes"
          placeholder="Add notes about your decision (visible to the coach if rejected)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
          disabled={isLoading !== null}
        />
        <p className="text-xs text-muted-foreground">{notes.length}/2000 characters</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-[hsl(var(--brand-surface))] p-3 text-sm text-[hsl(var(--brand-accent-hover))]">
          {success}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={() => handleAction('verified')}
          disabled={isLoading !== null}
          className="bg-[hsl(var(--brand-warm))] hover:bg-[hsl(var(--brand-accent-hover))]"
        >
          {isLoading === 'verified' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Approve
        </Button>
        <Button
          onClick={() => handleAction('rejected')}
          disabled={isLoading !== null}
          variant="destructive"
        >
          {isLoading === 'rejected' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="mr-2 h-4 w-4" />
          )}
          Reject
        </Button>
      </div>
    </div>
  );
}

export function VerificationBadge({ status }: { status: string }) {
  switch (status) {
    case 'verified':
      return (
        <Badge className="bg-[hsl(var(--brand-accent-light))] text-[hsl(var(--brand-accent-dark))] hover:bg-[hsl(var(--brand-accent-light))]">
          <CheckCircle className="mr-1 h-3 w-3" />
          Verified
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="destructive">
          <XCircle className="mr-1 h-3 w-3" />
          Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          Pending
        </Badge>
      );
  }
}
