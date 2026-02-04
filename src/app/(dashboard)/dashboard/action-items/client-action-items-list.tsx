'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Clock, Loader2, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { markActionItemComplete, type ActionItemWithCoach } from './actions';
import { cn } from '@/lib/utils';

interface ClientActionItemsListProps {
  initialFilter: 'all' | 'pending' | 'completed';
  initialItems: ActionItemWithCoach[];
  allCount: number;
  pendingCount: number;
  completedCount: number;
}

// Get initials from name
function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function ClientActionItemsList({
  initialFilter,
  initialItems,
  allCount,
  pendingCount,
  completedCount,
}: ClientActionItemsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loadingStates, setLoadingStates] = useState<Record<number, boolean>>({});

  const currentFilter = (searchParams.get('filter') || initialFilter) as
    | 'all'
    | 'pending'
    | 'completed';

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', value);
    }
    router.push(`/dashboard/action-items?${params.toString()}`);
  };

  const handleToggleComplete = async (item: ActionItemWithCoach) => {
    setLoadingStates((prev) => ({ ...prev, [item.id]: true }));

    try {
      const result = await markActionItemComplete(item.id, !item.isCompleted);

      if (result.success) {
        toast({
          title: item.isCompleted ? 'Marked as pending' : 'Marked as complete',
          description: `"${item.title}" has been updated.`,
        });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update action item',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const getStatusIcon = (status: ActionItemWithCoach['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'overdue':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Circle className="h-5 w-5 text-emerald-500" />;
    }
  };

  const getStatusBadge = (status: ActionItemWithCoach['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Completed
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
            Overdue
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            Pending
          </span>
        );
    }
  };

  // Filter items based on current filter
  const displayItems = initialItems.filter((item) => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'pending') return !item.isCompleted;
    if (currentFilter === 'completed') return item.isCompleted;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <Tabs value={currentFilter} onValueChange={handleFilterChange}>
        <TabsList>
          <TabsTrigger value="all">All ({allCount})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Action Items List */}
      {displayItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <CheckCircle2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No action items</p>
            <p className="text-sm text-muted-foreground">
              {currentFilter === 'completed'
                ? "You haven't completed any action items yet."
                : currentFilter === 'pending'
                  ? 'All caught up! No pending action items.'
                  : 'No action items assigned yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayItems.map((item) => {
            const isLoading = loadingStates[item.id];

            return (
              <Card
                key={item.id}
                className={cn('transition-opacity', item.isCompleted && 'opacity-70')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Toggle complete button */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handleToggleComplete(item)}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              getStatusIcon(item.status)
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {item.isCompleted ? 'Mark as pending' : 'Mark as complete'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={cn(
                            'font-medium',
                            item.isCompleted && 'text-muted-foreground line-through'
                          )}
                        >
                          {item.title}
                        </h3>
                        {getStatusBadge(item.status)}
                      </div>

                      {item.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        {/* Due date */}
                        {item.dueDate && (
                          <span
                            className={cn(
                              'flex items-center gap-1',
                              item.status === 'overdue' && 'font-medium text-red-500'
                            )}
                          >
                            <Clock className="h-4 w-4" />
                            Due {format(new Date(item.dueDate), 'MMM d, yyyy')}
                          </span>
                        )}

                        {/* Coach info */}
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={item.coachAvatar || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(item.coachName)}
                            </AvatarFallback>
                          </Avatar>
                          <span>From {item.coachName || 'Coach'}</span>
                        </div>

                        {/* Created date */}
                        <span className="hidden sm:inline">
                          Added {format(new Date(item.createdAt), 'MMM d')}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
