'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Send } from 'lucide-react';

interface SessionPrepFormProps {
  prepId: number;
  questions: string[];
  onComplete?: () => void;
}

const MAX_CHARS = 500;

export function SessionPrepForm({ prepId, questions, onComplete }: SessionPrepFormProps) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<string[]>(questions.map(() => ''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const updateAnswer = (index: number, value: string) => {
    if (value.length > MAX_CHARS) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const canSubmit = answers.every((a) => a.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast({
        title: 'Error',
        description: 'Please answer all questions before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/session-prep/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prepId,
          responses: questions.map((question, i) => ({
            question,
            answer: answers[i].trim(),
          })),
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Submission failed');
      }

      setIsCompleted(true);
      toast({
        title: 'Preparation submitted',
        description: 'Your coach will receive your answers before the session.',
      });

      // Delay callback so user sees success state
      if (onComplete) {
        setTimeout(onComplete, 2000);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Submission failed',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleted) {
    return (
      <Card className="border-sage/30 bg-sage/5">
        <CardContent className="flex items-center gap-3 p-6">
          <CheckCircle2 className="h-6 w-6 text-sage" />
          <div>
            <p className="font-semibold text-burgundy-dark">Preparation submitted!</p>
            <p className="text-sm text-muted-foreground">
              Your coach will be able to read your answers before the session.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-burgundy-dark">Session Preparation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {questions.map((question, index) => (
          <div key={index} className="space-y-1.5">
            <Label htmlFor={`prep-q-${index}`} className="text-sm font-medium">
              {question}
            </Label>
            <Textarea
              id={`prep-q-${index}`}
              placeholder="Write your answer..."
              value={answers[index]}
              onChange={(e) => updateAnswer(index, e.target.value)}
              rows={3}
              className="resize-y"
              disabled={isSubmitting}
            />
            <p className="text-right text-xs text-muted-foreground">
              {answers[index].length}/{MAX_CHARS}
            </p>
          </div>
        ))}

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="w-full bg-burgundy text-white hover:bg-burgundy-light"
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Submit preparation
        </Button>
      </CardContent>
    </Card>
  );
}
