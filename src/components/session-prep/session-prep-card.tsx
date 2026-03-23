'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, ClipboardList } from 'lucide-react';
import { SessionPrepForm } from './session-prep-form';

interface PendingPrep {
  id: number;
  bookingId: number;
  coachName: string;
  sessionDate: string;
  questions: string[];
  responses: null;
  promptedAt: string;
}

export function SessionPrepCard() {
  const [prep, setPrep] = useState<PendingPrep | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await fetch('/api/session-prep/pending');
        const result = await res.json();
        if (res.ok && result.success && result.data) {
          setPrep(result.data);
        }
      } catch {
        // Silently fail — card simply won't render
      } finally {
        setIsLoading(false);
      }
    };
    fetchPending();
  }, []);

  if (isLoading || !prep || completed) return null;

  const sessionDate = new Date(prep.sessionDate);
  const formattedDate = sessionDate.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const formattedTime = sessionDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (showForm) {
    return (
      <SessionPrepForm
        prepId={prep.id}
        questions={prep.questions}
        onComplete={() => {
          setShowForm(false);
          setCompleted(true);
        }}
      />
    );
  }

  return (
    <Card className="border-gold/30 bg-gold/5">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/20">
            <ClipboardList className="h-5 w-5 text-gold-dark" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-burgundy-dark">
              Prepare for your session
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {formattedDate} at {formattedTime} with {prep.coachName}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Your coach has prepared some questions to make the session even more effective.
            </p>
            <Button
              className="mt-3 bg-gold text-white hover:bg-gold-dark"
              onClick={() => setShowForm(true)}
            >
              Prepare now
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
