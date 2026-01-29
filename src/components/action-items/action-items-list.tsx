'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Clock, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  markActionItemComplete,
  deleteActionItem,
  type ActionItemWithStatus,
} from '@/app/(dashboard)/dashboard/action-items/actions';
import { cn } from '@/lib/utils';

interface ActionItemsListProps {
  items: ActionItemWithStatus[];
  onUpdate?: () => void;
  showDelete?: boolean;
  compact?: boolean;
}

export function ActionItemsList({
  items,
  onUpdate,
  showDelete = true,
  compact = false,
}: ActionItemsListProps) {
  const { toast } = useToast();
  const [loadingStates, setLoadingStates] = useState<Record<number, 'complete' | 'delete' | null>>(
    {}
  );

  const handleToggleComplete = async (item: ActionItemWithStatus) => {
    setLoadingStates((prev) => ({ ...prev, [item.id]: 'complete' }));

    try {
      const result = await markActionItemComplete(item.id, !item.isCompleted);

      if (result.success) {
        toast({
          title: item.isCompleted ? 'Marked as pending' : 'Marked as complete',
          description: `"${item.title}" has been updated.`,
        });
        onUpdate?.();
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
      setLoadingStates((prev) => ({ ...prev, [item.id]: null }));
    }
  };

  const handleDelete = async (item: ActionItemWithStatus) => {
    setLoadingStates((prev) => ({ ...prev, [item.id]: 'delete' }));

    try {
      const result = await deleteActionItem(item.id);

      if (result.success) {
        toast({
          title: 'Action item deleted',
          description: `"${item.title}" has been removed.`,
        });
        onUpdate?.();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to delete action item',
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
      setLoadingStates((prev) => ({ ...prev, [item.id]: null }));
    }
  };

  const getStatusIcon = (status: ActionItemWithStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'overdue':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Circle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: ActionItemWithStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'overdue':
        return 'text-red-500';
      case 'pending':
        return 'text-blue-500';
    }
  };

  const getStatusLabel = (status: ActionItemWithStatus['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'overdue':
        return 'Overdue';
      case 'pending':
        return 'Pending';
    }
  };

  if (items.length === 0) {
    return (
      <Card className="bg-background">
        <CardContent className="flex flex-col items-center py-6 text-center">
          <CheckCircle2 className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No action items</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isLoading = loadingStates[item.id];

        return (
          <Card
            key={item.id}
            className={cn(
              'bg-background transition-opacity',
              item.isCompleted && 'opacity-60'
            )}
          >
            <CardContent className={cn('p-3', compact && 'p-2')}>
              <div className="flex items-start gap-2">
                {/* Toggle complete button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => handleToggleComplete(item)}
                        disabled={isLoading !== null}
                      >
                        {isLoading === 'complete' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
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
                  <p
                    className={cn(
                      'text-sm font-medium',
                      item.isCompleted && 'line-through',
                      compact && 'text-xs'
                    )}
                  >
                    {item.title}
                  </p>

                  {!compact && item.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {item.dueDate && (
                      <span
                        className={cn(
                          'flex items-center gap-1',
                          item.status === 'overdue' && 'text-red-500 font-medium'
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        {format(new Date(item.dueDate), 'MMM d')}
                      </span>
                    )}
                    <span className={cn('text-xs', getStatusColor(item.status))}>
                      {getStatusLabel(item.status)}
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                {showDelete && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item)}
                          disabled={isLoading !== null}
                        >
                          {isLoading === 'delete' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete action item</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
