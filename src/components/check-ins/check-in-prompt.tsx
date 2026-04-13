'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PendingCheckIn {
  id: number;
  coachId: string;
  coachName: string;
  weekNumber: number;
  weekYear: number;
  promptedAt: string;
  mood: null;
  note: null;
}

type Mood = 'good' | 'okay' | 'struggling';

const MOOD_OPTIONS: { mood: Mood; emoji: string; label: string; colorClass: string }[] = [
  {
    mood: 'good',
    emoji: '😊',
    label: 'Good',
    colorClass: 'border-sage bg-sage/10 hover:bg-sage/20 ring-sage',
  },
  {
    mood: 'okay',
    emoji: '😐',
    label: 'Okay',
    colorClass: 'border-gold bg-gold/10 hover:bg-gold/20 ring-gold',
  },
  {
    mood: 'struggling',
    emoji: '😔',
    label: 'Struggling',
    colorClass: 'border-burgundy bg-burgundy/10 hover:bg-burgundy/20 ring-burgundy',
  },
];

const NOTE_MAX = 280;

export function CheckInPrompt() {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingCheckIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch('/api/check-ins/pending')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setPending(json.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!selectedMood || !pending) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/check-ins/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInId: pending.id,
          mood: selectedMood,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitted(true);
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'Please try again later',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Unable to send check-in', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!pending) return null;

  if (submitted) {
    return (
      <Card className="border-sage/50 bg-sage/5">
        <CardContent className="flex flex-col items-center py-8">
          <span className="text-4xl" role="img" aria-label="thank you">
            ✅
          </span>
          <p className="mt-3 text-lg font-semibold text-sage">Thank you!</p>
          <p className="text-sm text-muted-foreground">Your check-in has been sent.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-burgundy-dark">How are you doing this week?</CardTitle>
        <p className="text-sm text-muted-foreground">Weekly check-in for {pending.coachName}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {MOOD_OPTIONS.map((option) => (
            <button
              key={option.mood}
              type="button"
              onClick={() => setSelectedMood(option.mood)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
                option.colorClass,
                selectedMood === option.mood
                  ? 'scale-105 ring-2 ring-offset-2'
                  : 'opacity-80 hover:opacity-100'
              )}
            >
              <span className="text-3xl" role="img" aria-label={option.label}>
                {option.emoji}
              </span>
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>

        {selectedMood && (
          <div className="space-y-2">
            <Textarea
              placeholder="Want to add a note? (optional)"
              value={note}
              onChange={(e) => {
                if (e.target.value.length <= NOTE_MAX) {
                  setNote(e.target.value);
                }
              }}
              rows={3}
              className="resize-none"
            />
            <p className="text-right text-xs text-muted-foreground">
              {note.length}/{NOTE_MAX}
            </p>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!selectedMood || submitting}
          className="w-full bg-burgundy text-white hover:bg-burgundy-light"
        >
          {submitting ? 'Sending...' : 'Send'}
        </Button>
      </CardContent>
    </Card>
  );
}
