'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ClipboardList, Clock, Eye } from 'lucide-react';

interface PrepData {
  id: number;
  bookingId: number;
  userId: string;
  clientName: string;
  responses: Array<{ question: string; answer: string }>;
  promptedAt: string;
  completedAt: string | null;
  viewedByCoach: boolean;
}

interface SessionPrepViewProps {
  bookingId: number;
}

export function SessionPrepView({ bookingId }: SessionPrepViewProps) {
  const [prep, setPrep] = useState<PrepData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchPrep = async () => {
      try {
        const res = await fetch(`/api/session-prep/booking/${bookingId}`);
        const result = await res.json();
        if (res.ok && result.success && result.data) {
          setPrep(result.data);
          // Auto-mark as viewed if completed and not yet viewed
          if (result.data.completedAt && !result.data.viewedByCoach) {
            markViewed(result.data.id);
          }
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPrep();
  }, [bookingId]);

  const markViewed = async (prepId: number) => {
    try {
      await fetch(`/api/session-prep/${prepId}/viewed`, { method: 'PATCH' });
      setPrep((prev) => prev ? { ...prev, viewedByCoach: true } : prev);
    } catch {
      // Non-critical — silently fail
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (notFound || !prep) return null;

  const isCompleted = prep.completedAt !== null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Client Preparation
          </CardTitle>
          {isCompleted ? (
            <Badge variant="outline" className="border-sage text-sage">
              <Eye className="mr-1 h-3 w-3" />
              Completed
            </Badge>
          ) : (
            <Badge variant="outline" className="border-gold text-gold-dark">
              <Clock className="mr-1 h-3 w-3" />
              Pending
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!isCompleted ? (
          <p className="text-sm text-muted-foreground">
            The client has not yet completed the session preparation.
          </p>
        ) : (
          <div className="space-y-4">
            {prep.responses.map((item, index) => (
              <div key={index} className="space-y-1">
                <p className="text-sm font-medium text-burgundy-dark">
                  {item.question}
                </p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
