'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ClientSessionCard } from './client-session-card';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
import type {
  SessionWithCoach,
  ClientSessionStatus,
} from '@/app/(dashboard)/dashboard/my-sessions/actions';
import {
  cancelClientSession,
  generateClientIcsFile,
  createRetryCheckoutSession,
} from '@/app/(dashboard)/dashboard/my-sessions/actions';

interface ClientSessionsListProps {
  initialTab: ClientSessionStatus;
  initialSessions: SessionWithCoach[];
  initialTotalCount: number;
  currentPage: number;
  perPage: number;
}

export function ClientSessionsList({
  initialTab,
  initialSessions,
  initialTotalCount,
  currentPage,
  perPage,
}: ClientSessionsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [sessions, setSessions] = useState(initialSessions);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [activeTab, setActiveTab] = useState<ClientSessionStatus>(initialTab);

  const totalPages = Math.ceil(totalCount / perPage);

  const handleTabChange = (value: string) => {
    const tab = value as ClientSessionStatus;
    setActiveTab(tab);

    // Update URL and reset to page 1
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tab);
      params.delete('page'); // Reset to page 1
      router.push(`/dashboard/my-sessions?${params.toString()}`);
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
      router.push(`/dashboard/my-sessions?${params.toString()}`);
    });
  };

  const handleCancel = async (sessionId: number, reason: string, details: string) => {
    // Combine reason and details into a single cancellation reason
    const fullReason = details ? `${reason}: ${details}` : reason;
    const result = await cancelClientSession(sessionId, fullReason);

    if (result.success) {
      toast({
        title: 'Session cancelled',
        description: 'Your session has been cancelled successfully.',
      });
      // Remove from current list if on upcoming tab, or update status if on past tab
      if (activeTab === 'upcoming') {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setTotalCount((prev) => prev - 1);
      } else {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, status: 'cancelled' as const } : s))
        );
      }
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to cancel session',
        variant: 'destructive',
      });
    }
  };

  const handleAddToCalendar = async (sessionId: number) => {
    const result = await generateClientIcsFile(sessionId);

    if (result.success) {
      // Create a download link for the ICS file
      const blob = new Blob([result.data], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `coaching-session-${sessionId}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Calendar file downloaded',
        description: 'Open the downloaded file to add this session to your calendar.',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to generate calendar file',
        variant: 'destructive',
      });
    }
  };

  const handlePayNow = async (sessionId: number) => {
    // Get client's timezone from browser
    const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = await createRetryCheckoutSession(sessionId, clientTimezone);

    if (result.success) {
      // Redirect to Stripe Checkout
      window.location.href = result.checkoutUrl;
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to create checkout session',
        variant: 'destructive',
      });
    }
  };

  const EmptyState = ({ type }: { type: ClientSessionStatus }) => {
    const config = {
      upcoming: {
        icon: Calendar,
        title: 'No upcoming sessions',
        description:
          "You don't have any upcoming sessions scheduled. Browse coaches and book your first session!",
      },
      past: {
        icon: Clock,
        title: 'No past sessions',
        description:
          "You haven't had any sessions yet. Your completed and cancelled sessions will appear here.",
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
        {type === 'upcoming' && (
          <Button className="mt-4" asChild>
            <a href="/coaches">Find a Coach</a>
          </Button>
        )}
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

  const SessionsContent = ({ tab }: { tab: ClientSessionStatus }) => {
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
            <ClientSessionCard
              key={session.id}
              session={session}
              onCancel={handleCancel}
              onAddToCalendar={handleAddToCalendar}
              onPayNow={handlePayNow}
              isUpcoming={tab === 'upcoming'}
            />
          ))}
        </div>

        <Pagination />
      </div>
    );
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="mb-6 grid w-full grid-cols-2 lg:w-[300px]">
        <TabsTrigger value="upcoming" disabled={isPending}>
          Upcoming
        </TabsTrigger>
        <TabsTrigger value="past" disabled={isPending}>
          Past
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming">
        <SessionsContent tab="upcoming" />
      </TabsContent>

      <TabsContent value="past">
        <SessionsContent tab="past" />
      </TabsContent>
    </Tabs>
  );
}
