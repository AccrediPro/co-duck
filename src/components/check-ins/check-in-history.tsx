'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CheckInEntry {
  id: number;
  mood: 'good' | 'okay' | 'struggling' | null;
  note: string | null;
  weekNumber: number;
  weekYear: number;
  respondedAt: string | null;
}

const MOOD_CONFIG = {
  good: { y: 20, color: '#22C55E', emoji: '😊', label: 'Good' },
  okay: { y: 50, color: '#F97316', emoji: '😐', label: 'Okay' },
  struggling: { y: 80, color: '#0D9488', emoji: '😔', label: 'Struggling' },
} as const;

export function CheckInHistory() {
  const [entries, setEntries] = useState<CheckInEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/check-ins/history?limit=12')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setEntries(json.data);
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
        <CardContent className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const respondedEntries = entries.filter((e) => e.mood && e.respondedAt);
  const chartEntries = [...respondedEntries].reverse();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-burgundy-dark">Your Check-ins</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {chartEntries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No check-ins completed.</p>
        ) : (
          <>
            <MoodChart entries={chartEntries} />
            <div className="space-y-2">
              {respondedEntries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <span className="text-xl" role="img" aria-label={entry.mood ?? ''}>
                    {entry.mood ? MOOD_CONFIG[entry.mood].emoji : '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Wk. {entry.weekNumber}, {entry.weekYear}
                      </span>
                      <span
                        className={cn(
                          'inline-block h-2 w-2 rounded-full',
                          entry.mood === 'good' && 'bg-sage',
                          entry.mood === 'okay' && 'bg-gold',
                          entry.mood === 'struggling' && 'bg-burgundy'
                        )}
                      />
                    </div>
                    {entry.note && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {entry.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MoodChart({ entries }: { entries: CheckInEntry[] }) {
  const width = 400;
  const height = 100;
  const padding = { top: 10, right: 20, bottom: 10, left: 20 };
  const chartWidth = width - padding.left - padding.right;

  const step = entries.length > 1 ? chartWidth / (entries.length - 1) : 0;

  const points = entries.map((entry, i) => {
    const mood = entry.mood as 'good' | 'okay' | 'struggling';
    const config = MOOD_CONFIG[mood];
    return {
      x: padding.left + i * step,
      y: padding.top + (config.y * (height - padding.top - padding.bottom)) / 100,
      color: config.color,
      entry,
    };
  });

  const linePath =
    points.length > 1 ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : '';

  return (
    <TooltipProvider>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Mood chart last few weeks"
      >
        {/* Y-axis labels */}
        <text
          x={padding.left - 4}
          y={padding.top + 2}
          className="fill-muted-foreground"
          fontSize="8"
          textAnchor="end"
        >
          😊
        </text>
        <text
          x={padding.left - 4}
          y={padding.top + (height - padding.top - padding.bottom) * 0.5 + 2}
          className="fill-muted-foreground"
          fontSize="8"
          textAnchor="end"
        >
          😐
        </text>
        <text
          x={padding.left - 4}
          y={padding.top + (height - padding.top - padding.bottom) * 0.8 + 2}
          className="fill-muted-foreground"
          fontSize="8"
          textAnchor="end"
        >
          😔
        </text>

        {/* Grid lines */}
        {[20, 50, 80].map((pct) => (
          <line
            key={pct}
            x1={padding.left}
            y1={padding.top + (pct * (height - padding.top - padding.bottom)) / 100}
            x2={width - padding.right}
            y2={padding.top + (pct * (height - padding.top - padding.bottom)) / 100}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeDasharray="4 4"
          />
        ))}

        {/* Connecting line */}
        {linePath && (
          <path d={linePath} fill="none" stroke="#0D9488" strokeWidth={2} strokeOpacity={0.4} />
        )}

        {/* Dots */}
        {points.map((p, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <circle
                cx={p.x}
                cy={p.y}
                r={5}
                fill={p.color}
                stroke="white"
                strokeWidth={2}
                className="hover:r-[7] cursor-pointer transition-all"
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="font-medium">
                Wk. {p.entry.weekNumber} —{' '}
                {MOOD_CONFIG[p.entry.mood as 'good' | 'okay' | 'struggling'].label}
              </p>
              {p.entry.note && (
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{p.entry.note}</p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </svg>
    </TooltipProvider>
  );
}
