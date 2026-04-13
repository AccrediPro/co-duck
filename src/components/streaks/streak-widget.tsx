'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  isAtRisk: boolean;
  lastActivityAt: string | null;
  streakStartedAt: string | null;
  thisWeekActivities: { type: string; at: string }[];
}

const MILESTONES = [4, 8, 12, 24, 52];

function getNextMilestone(current: number): number {
  for (const m of MILESTONES) {
    if (current < m) return m;
  }
  return current + 52;
}

function getMilestoneProgress(current: number): number {
  const next = getNextMilestone(current);
  const prev = MILESTONES.filter((m) => m <= current).pop() ?? 0;
  if (next === prev) return 100;
  return Math.round(((current - prev) / (next - prev)) * 100);
}

export function StreakWidget() {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/streaks/me')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="mx-auto h-16 w-16 rounded-full" />
          <Skeleton className="mx-auto h-4 w-48" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const isZero = data.currentStreak === 0;
  const nextMilestone = getNextMilestone(data.currentStreak);
  const progress = getMilestoneProgress(data.currentStreak);

  return (
    <Card
      className={cn(
        'relative overflow-hidden',
        data.isAtRisk &&
          !isZero &&
          'animate-pulse border-gold shadow-[0_0_0_1px_rgba(212,175,55,0.3)]'
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-burgundy-dark">
          <span className="text-lg">Your Streak</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isZero ? (
          <div className="py-4 text-center">
            <span className="text-4xl" role="img" aria-label="fire">
              🔥
            </span>
            <p className="mt-2 text-base font-medium text-muted-foreground">Start your streak!</p>
            <p className="text-sm text-muted-foreground">
              Complete an activity this week to get started.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3">
              <span className="text-5xl" role="img" aria-label="fire">
                🔥
              </span>
              <div>
                <p className="text-4xl font-bold text-burgundy-dark">{data.currentStreak}</p>
                <p className="text-sm text-muted-foreground">
                  {data.currentStreak === 1 ? 'week' : 'weeks'}
                </p>
              </div>
            </div>

            {data.isAtRisk && (
              <p className="text-center text-sm font-medium text-gold-dark">
                Complete an action today!
              </p>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Next milestone: {nextMilestone} wks.</span>
                <span>
                  {data.currentStreak}/{nextMilestone}
                </span>
              </div>
              <Progress value={progress} className="h-2 bg-cream" />
            </div>

            <div className="flex justify-center">
              <Badge variant="secondary" className="gap-1.5 bg-cream text-burgundy">
                Record: {data.longestStreak} {data.longestStreak === 1 ? 'week' : 'weeks'}
              </Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
