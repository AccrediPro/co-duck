'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Save, RotateCcw, ClipboardList } from 'lucide-react';

const MIN_QUESTIONS = 2;
const MAX_QUESTIONS = 5;

const DEFAULT_QUESTIONS = [
  'What would you like to get out of today\'s session?',
  'Is there something specific you\'d like to discuss?',
  'How do you feel about your progress since the last session?',
];

export function PrepQuestionsConfig() {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<string[]>([]);
  const [originalQuestions, setOriginalQuestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/session-prep/questions');
      const result = await res.json();
      if (res.ok && result.success) {
        setQuestions(result.data.questions);
        setOriginalQuestions(result.data.questions);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Unable to load preparation questions.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const hasChanges =
    questions.length !== originalQuestions.length ||
    questions.some((q, i) => q !== originalQuestions[i]);

  const updateQuestion = (index: number, value: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addQuestion = () => {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions((prev) => [...prev, '']);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= MIN_QUESTIONS) return;
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const resetToDefaults = () => {
    setQuestions([...DEFAULT_QUESTIONS]);
  };

  const handleSave = async () => {
    const cleaned = questions.map((q) => q.trim()).filter((q) => q.length > 0);

    if (cleaned.length < MIN_QUESTIONS) {
      toast({
        title: 'Error',
        description: `At least ${MIN_QUESTIONS} questions are required.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/session-prep/questions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: cleaned }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || 'Save failed');
      }

      setQuestions(result.data.questions);
      setOriginalQuestions(result.data.questions);
      toast({
        title: 'Questions saved',
        description: 'Preparation questions have been updated.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Save failed',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Preparation Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Preparation Questions
        </CardTitle>
        <CardDescription>
          Questions sent to clients before each session to help them prepare.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((question, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor={`prep-config-q-${index}`} className="text-xs text-muted-foreground">
                Question {index + 1}
              </Label>
              <Input
                id={`prep-config-q-${index}`}
                placeholder="Write the question..."
                value={question}
                onChange={(e) => updateQuestion(index, e.target.value)}
              />
            </div>
            {questions.length > MIN_QUESTIONS && (
              <Button
                variant="ghost"
                size="icon"
                className="mt-6 shrink-0"
                onClick={() => removeQuestion(index)}
                aria-label={`Remove question ${index + 1}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}

        {questions.length < MAX_QUESTIONS && (
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="mr-2 h-4 w-4" />
            Add question
          </Button>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            size="sm"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
