'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDateLong, formatTime } from '@/lib/date-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  User,
  CheckCircle,
  XCircle,
  Eye,
  CreditCard,
  Loader2,
} from 'lucide-react';
import { CancellationDialog } from './cancellation-dialog';
import type { RefundEligibilityInfo } from './cancellation-dialog';
import type {
  SessionWithClient,
  PaymentStatus,
} from '@/app/(dashboard)/dashboard/sessions/actions';

interface SessionCardProps {
  session: SessionWithClient;
  onMarkComplete?: (sessionId: number) => Promise<void>;
  onCancel?: (sessionId: number, reason: string, details: string) => Promise<void>;
  onAccept?: (sessionId: number) => Promise<void>;
  onReject?: (sessionId: number) => Promise<void>;
  isPast?: boolean;
  isCancelled?: boolean;
  refundInfo?: RefundEligibilityInfo;
}

export function SessionCard({
  session,
  onMarkComplete,
  onCancel,
  onAccept,
  onReject,
  isPast = false,
  isCancelled = false,
  refundInfo,
}: SessionCardProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const isPendingApproval = session.status === 'pending' && !isPast;
  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };


  const getPaymentBadge = (status: PaymentStatus, price: number) => {
    // No badge for free sessions
    if (status === 'free' || price === 0) return null;

    switch (status) {
      case 'paid':
        return (
          <Badge variant="outline" className="border-[hsl(var(--brand-accent))] bg-[hsl(var(--brand-surface))] text-[hsl(var(--brand-accent-hover))]">
            <CreditCard className="mr-1 h-3 w-3" />
            Paid
          </Badge>
        );
      case 'payment_required':
        return (
          <Badge variant="secondary" className="bg-gold/15 text-gold-dark">
            <CreditCard className="mr-1 h-3 w-3" />
            Payment Required
          </Badge>
        );
      case 'payment_failed':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-700">
            <CreditCard className="mr-1 h-3 w-3" />
            Payment Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const handleAccept = async () => {
    if (!onAccept) return;
    setIsAccepting(true);
    try {
      await onAccept(session.id);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setIsRejecting(true);
    try {
      await onReject(session.id);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <Card
      className={
        isPendingApproval
          ? 'border-gold/40 bg-gold/5 transition-all hover:border-gold/60 hover:shadow-md'
          : 'transition-all hover:border-primary/30 hover:shadow-md'
      }
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Client info and session details */}
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={session.clientAvatar || undefined} alt={session.clientName || ''} />
              <AvatarFallback>
                {session.clientName ? (
                  getInitials(session.clientName)
                ) : (
                  <User className="h-5 w-5" />
                )}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{session.clientName || 'Unknown Client'}</h3>
                <StatusBadge status={session.status} label={session.status === 'pending' ? 'Pending Approval' : undefined} />
                {getPaymentBadge(session.paymentStatus, session.sessionType.price)}
              </div>

              <p className="mt-1 text-sm font-medium text-primary">{session.sessionType.name}</p>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateLong(session.startTime)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(session.startTime)} -{' '}
                  {formatTime(session.endTime)}
                </span>
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                {session.sessionType.duration} min - {formatPrice(session.sessionType.price)}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/sessions/${session.id}`}>
                <Eye className="mr-1.5 h-4 w-4" />
                View
              </Link>
            </Button>

            {/* Accept/Reject buttons for pending approval */}
            {isPendingApproval && onAccept && (
              <Button
                variant="default"
                size="sm"
                className="bg-[hsl(var(--brand-warm))] hover:bg-[hsl(var(--brand-accent-hover))]"
                onClick={handleAccept}
                disabled={isAccepting || isRejecting}
              >
                {isAccepting ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                )}
                Accept
              </Button>
            )}

            {isPendingApproval && onReject && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleReject}
                disabled={isAccepting || isRejecting}
              >
                {isRejecting ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-1.5 h-4 w-4" />
                )}
                Reject
              </Button>
            )}

            {/* Mark complete button for past sessions */}
            {isPast &&
              !isCancelled &&
              session.status !== 'completed' &&
              session.status !== 'no_show' &&
              onMarkComplete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMarkComplete(session.id)}
                  className="text-[hsl(var(--brand-warm))] hover:bg-[hsl(var(--brand-surface))] hover:text-[hsl(var(--brand-accent-hover))]"
                >
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                  Complete
                </Button>
              )}

            {/* Cancel button for non-pending sessions */}
            {!isPendingApproval &&
              !isCancelled &&
              session.status !== 'completed' &&
              session.status !== 'cancelled' &&
              onCancel && (
                <CancellationDialog
                  onCancel={(reason, details) => onCancel(session.id, reason, details)}
                  otherPartyName={session.clientName || 'the client'}
                  sessionTime={session.startTime}
                  isCoach={true}
                  refundInfo={refundInfo}
                  triggerButton={
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Cancel
                    </Button>
                  }
                />
              )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
