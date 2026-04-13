'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TimelineEntry {
  id: number;
  mood: 'good' | 'okay' | 'struggling' | null;
  note: string | null;
  weekNumber: number;
  weekYear: number;
  respondedAt: string | null;
  promptedAt: string;
}

const MOOD_CONFIG = {
  good: { emoji: '😊', label: 'Good', dotClass: 'bg-sage', lineClass: 'border-sage/40' },
  okay: { emoji: '😐', label: 'Okay', dotClass: 'bg-gold', lineClass: 'border-gold/40' },
  struggling: {
    emoji: '😔',
    label: 'Struggling',
    dotClass: 'bg-burgundy',
    lineClass: 'border-burgundy/40',
  },
} as const;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface ClientCheckInTimelineProps {
  clientId: string;
}

export function ClientCheckInTimeline({ clientId }: ClientCheckInTimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/check-ins/client/${clientId}?limit=20`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setEntries(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-burgundy-dark">Check-in</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No check-ins available.</p>
        ) : (
          <div className="relative">
            {entries.map((entry, i) => {
              const isLast = i === entries.length - 1;
              const moodConfig = entry.mood ? MOOD_CONFIG[entry.mood] : null;

              return (
                <div key={entry.id} className="relative flex gap-4 pb-6">
                  {/* Timeline line */}
                  {!isLast && (
                    <div
                      className={cn(
                        'absolute left-3 top-6 h-full w-0 border-l-2',
                        moodConfig?.lineClass ?? 'border-muted'
                      )}
                    />
                  )}

                  {/* Timeline dot */}
                  <div
                    className={cn(
                      'relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-background',
                      moodConfig?.dotClass ?? 'bg-muted'
                    )}
                  >
                    {moodConfig && (
                      <span className="text-xs" role="img" aria-label={moodConfig.label}>
                        {moodConfig.emoji}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Wk. {entry.weekNumber}, {entry.weekYear}
                      </span>
                      {moodConfig && (
                        <span className="text-xs text-muted-foreground">{moodConfig.label}</span>
                      )}
                    </div>
                    {entry.respondedAt ? (
                      <p className="text-xs text-muted-foreground">
                        Responded on {formatDate(entry.respondedAt)}
                      </p>
                    ) : (
                      <p className="text-xs text-gold-dark">Awaiting response</p>
                    )}
                    {entry.note && (
                      <p className="mt-1 rounded bg-muted/50 p-2 text-sm text-muted-foreground">
                        {entry.note}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
