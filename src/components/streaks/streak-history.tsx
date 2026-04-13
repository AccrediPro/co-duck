'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface WeekData {
  weekNumber: number;
  weekYear: number;
  activities: { type: string; at: string }[];
  hasActivity: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  session_completed: 'Session completed',
  check_in_submitted: 'Check-in submitted',
  action_item_completed: 'Action completed',
  session_prep_completed: 'Session preparation',
  message_sent: 'Message sent',
};

function getActionLabel(type: string): string {
  return ACTION_LABELS[type] ?? type.replace(/_/g, ' ');
}

export function StreakHistory() {
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/streaks/history?weeks=12')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setWeeks(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-1.5">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-sm" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const reversed = [...weeks].reverse();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-burgundy-dark">Last 12 Weeks</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={200}>
          <div className="grid grid-cols-12 gap-1.5">
            {reversed.map((week) => {
              const activityTypes = Array.from(new Set(week.activities.map((a) => a.type)));
              const tooltipText = week.hasActivity
                ? activityTypes.map(getActionLabel).join(', ')
                : 'No activity';

              return (
                <Tooltip key={`${week.weekYear}-${week.weekNumber}`}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'aspect-square rounded-sm transition-colors',
                        week.hasActivity ? 'bg-sage' : 'bg-muted'
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Wk. {week.weekNumber} — {tooltipText}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-muted" />
              <span>Inactive</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-sage" />
              <span>Active</span>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
