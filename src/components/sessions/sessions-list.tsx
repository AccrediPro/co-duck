'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SessionCard } from './session-card';
import { ChevronLeft, ChevronRight, Calendar, Clock, XCircle } from 'lucide-react';
import type {
  SessionWithClient,
  SessionStatus,
} from '@/app/(dashboard)/dashboard/sessions/actions';
import {
  markSessionComplete,
  cancelSession,
  getRefundEligibility,
} from '@/app/(dashboard)/dashboard/sessions/actions';
import type { RefundEligibilityInfo } from './cancellation-dialog';

interface SessionsListProps {
  initialTab: SessionStatus;
  initialSessions: SessionWithClient[];
  initialTotalCount: number;
  currentPage: number;
  perPage: number;
}

export function SessionsList({
  initialTab,
  initialSessions,
  initialTotalCount,
  currentPage,
  perPage,
}: SessionsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [sessions, setSessions] = useState(initialSessions);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [activeTab, setActiveTab] = useState<SessionStatus>(initialTab);
  const [refundInfoCache, setRefundInfoCache] = useState<Record<number, RefundEligibilityInfo>>({});

  const totalPages = Math.ceil(totalCount / perPage);

  const handleTabChange = (value: string) => {
    const tab = value as SessionStatus;
    setActiveTab(tab);

    // Update URL and reset to page 1
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      params.delete('page'); // Reset to page 1
      router.push(`/dashboard/sessions?${params.toString()}`);
    });
  };

  const goToPage = (page: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (page === 1) {
        params.delete('page');
      } else {
        params.set('page', page.toString());
      }
      router.push(`/dashboard/sessions?${params.toString()}`);
    });
  };

  const handleMarkComplete = async (sessionId: number) => {
    const result = await markSessionComplete(sessionId);

    if (result.success) {
      toast({
        title: 'Session marked as complete',
        description: 'The session has been successfully marked as completed.',
      });
      // Update local state
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: 'completed' as const } : s))
      );
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to mark session as complete',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async (sessionId: number, reason: string, details: string) => {
    // Combine reason and details into a single cancellation reason
    const fullReason = details ? `${reason}: ${details}` : reason;
    const result = await cancelSession(sessionId, fullReason);

    if (result.success) {
      // Build description based on refund result
      let description = 'The session has been cancelled successfully.';
      if (result.refund?.wasRefunded) {
        description = `Session cancelled. A refund of ${result.refund.refundAmountFormatted} has been issued to the client.`;
      }

      toast({
        title: 'Session cancelled',
        description,
      });
      // Remove from current list (it will appear in cancelled tab)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setTotalCount((prev) => prev - 1);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to cancel session',
        variant: 'destructive',
      });
    }
  };

  // Load refund info for a session (for cancellation dialog)
  const loadRefundInfo = async (sessionId: number): Promise<RefundEligibilityInfo | undefined> => {
    // Check cache first
    if (refundInfoCache[sessionId]) {
      return refundInfoCache[sessionId];
    }

    const result = await getRefundEligibility(sessionId);
    if (result.success && result.data) {
      const info: RefundEligibilityInfo = {
        hasPaidTransaction: result.data.hasPaidTransaction,
        isEligibleForRefund: result.data.isEligibleForRefund,
        refundAmountFormatted: result.data.refundAmountFormatted,
        refundReason: result.data.refundReason,
      };
      setRefundInfoCache((prev) => ({ ...prev, [sessionId]: info }));
      return info;
    }
    return undefined;
  };

  // Preload refund info for paid sessions when component mounts
  useState(() => {
    sessions.forEach((session) => {
      if (session.paymentStatus === 'paid') {
        loadRefundInfo(session.id);
      }
    });
  });

  const EmptyState = ({ type }: { type: SessionStatus }) => {
    const config = {
      upcoming: {
        icon: Calendar,
        title: 'No upcoming sessions',
        description:
          "You don't have any upcoming sessions scheduled. Once clients book sessions with you, they'll appear here.",
      },
      past: {
        icon: Clock,
        title: 'No past sessions',
        description:
          "You haven't had any sessions yet. Your completed sessions will appear here after they take place.",
      },
      cancelled: {
        icon: XCircle,
        title: 'No cancelled sessions',
        description: "You don't have any cancelled sessions. That's a good thing!",
      },
    };

    const { icon: Icon, title, description } = config[type];

    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 max-w-md text-muted-foreground">{description}</p>
      </div>
    );
  };

  const Pagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="mt-8 flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1 || isPending}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-1">
          {/* First page */}
          {currentPage > 3 && (
            <>
              <Button
                variant={currentPage === 1 ? 'default' : 'ghost'}
                size="sm"
                onClick={() => goToPage(1)}
                disabled={isPending}
                className="min-w-[36px]"
              >
                1
              </Button>
              {currentPage > 4 && <span className="px-2 text-muted-foreground">...</span>}
            </>
          )}

          {/* Pages around current */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
              if (totalPages <= 7) return true;
              if (page >= currentPage - 2 && page <= currentPage + 2) return true;
              return false;
            })
            .map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'ghost'}
                size="sm"
                onClick={() => goToPage(page)}
                disabled={isPending}
                className="min-w-[36px]"
              >
                {page}
              </Button>
            ))}

          {/* Last page */}
          {currentPage < totalPages - 2 && (
            <>
              {currentPage < totalPages - 3 && (
                <span className="px-2 text-muted-foreground">...</span>
              )}
              <Button
                variant={currentPage === totalPages ? 'default' : 'ghost'}
                size="sm"
                onClick={() => goToPage(totalPages)}
                disabled={isPending}
                className="min-w-[36px]"
              >
                {totalPages}
              </Button>
            </>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages || isPending}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    );
  };

  const SessionsContent = ({ tab }: { tab: SessionStatus }) => {
    if (sessions.length === 0) {
      return <EmptyState type={tab} />;
    }

    return (
      <div>
        {totalCount > 0 && (
          <p className="mb-4 text-sm text-muted-foreground">
            Showing {(currentPage - 1) * perPage + 1}-{Math.min(currentPage * perPage, totalCount)}{' '}
            of {totalCount} session{totalCount !== 1 ? 's' : ''}
          </p>
        )}

        <div className="space-y-4">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onMarkComplete={handleMarkComplete}
              onCancel={handleCancel}
              isPast={tab === 'past'}
              isCancelled={tab === 'cancelled'}
              refundInfo={refundInfoCache[session.id]}
            />
          ))}
        </div>

        <Pagination />
      </div>
    );
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="mb-6 grid w-full grid-cols-3 lg:w-[400px]">
        <TabsTrigger value="upcoming" disabled={isPending}>
          Upcoming
        </TabsTrigger>
        <TabsTrigger value="past" disabled={isPending}>
          Past
        </TabsTrigger>
        <TabsTrigger value="cancelled" disabled={isPending}>
          Cancelled
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming">
        <SessionsContent tab="upcoming" />
      </TabsContent>

      <TabsContent value="past">
        <SessionsContent tab="past" />
      </TabsContent>

      <TabsContent value="cancelled">
        <SessionsContent tab="cancelled" />
      </TabsContent>
    </Tabs>
  );
}
