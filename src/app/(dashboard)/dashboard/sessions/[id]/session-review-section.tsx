'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/date-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StarRating } from '@/components/ui/star-rating';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquareReply } from 'lucide-react';

interface SessionReviewSectionProps {
  review: {
    id: number;
    rating: number;
    title: string | null;
    content: string | null;
    coachResponse: string | null;
    createdAt: string;
    clientName: string;
  };
  isCoachView: boolean;
}

export function SessionReviewSection({ review, isCoachView }: SessionReviewSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coachResponse, setCoachResponse] = useState(review.coachResponse);
  const { toast } = useToast();

  const formattedDate = formatDate(review.createdAt);

  const handleSubmit = async () => {
    if (!response.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/response`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachResponse: response.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to submit response');
      }

      setCoachResponse(response.trim());
      setShowForm(false);
      setResponse('');
      toast({
        title: 'Response submitted',
        description: 'Your response is now visible to the client.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to submit response',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Review display */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <StarRating rating={review.rating} size="sm" />
              {review.title && <h4 className="font-semibold">{review.title}</h4>}
            </div>
            <div className="shrink-0 text-right text-sm text-muted-foreground">
              <p className="font-medium">{review.clientName}</p>
              <p>{formattedDate}</p>
            </div>
          </div>
          {review.content && <p className="text-sm text-muted-foreground">{review.content}</p>}
        </div>

        {/* Coach response display */}
        {coachResponse && (
          <div className="rounded-lg bg-muted p-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Your Response</p>
            <p className="text-sm">{coachResponse}</p>
          </div>
        )}

        {/* Coach response form */}
        {isCoachView && !coachResponse && (
          <>
            {!showForm ? (
              <Button variant="outline" onClick={() => setShowForm(true)}>
                <MessageSquareReply className="mr-2 h-4 w-4" />
                Respond to Review
              </Button>
            ) : (
              <div className="space-y-3 rounded-lg border p-4">
                <Textarea
                  placeholder="Write your response to this review..."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  disabled={isSubmitting}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{response.length}/2000 characters</p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowForm(false);
                        setResponse('');
                      }}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmit}
                      disabled={isSubmitting || !response.trim()}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Response'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
