'use client';

import { useState } from 'react';
import type { FormQuestionData } from '@/lib/validators/forms';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Answer = string | string[] | number | boolean | undefined;
type AnswerMap = Record<string, Answer>;

interface FormRunnerProps {
  title: string;
  description?: string | null;
  questions: FormQuestionData[];
  /** If true, runner is read-only (preview mode). */
  readOnly?: boolean;
  /** Called on submit. Return a rejected promise to keep the form open. */
  onSubmit?: (answers: AnswerMap) => Promise<void> | void;
  submitLabel?: string;
}

/**
 * Renders a form as a client would see it.
 *
 * Used by:
 *  - `/dashboard/forms/builder/[id]` — preview mode (readOnly)
 *  - `/booking/[bookingId]/intake` — live submission
 *  - future public form share pages
 */
export function FormRunner({
  title,
  description,
  questions,
  readOnly,
  onSubmit,
  submitLabel = 'Submit',
}: FormRunnerProps) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const setAnswer = (id: string, value: Answer) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    for (const q of questions) {
      if (!q.required) continue;
      const a = answers[q.id];
      if (a === undefined || a === null || a === '') {
        next[q.id] = 'This question is required';
        continue;
      }
      if (Array.isArray(a) && a.length === 0) {
        next[q.id] = 'Pick at least one option';
      }
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    if (!onSubmit) return;
    try {
      setSubmitting(true);
      await onSubmit(answers);
    } finally {
      setSubmitting(false);
    }
  };

  const sorted = [...questions].sort((a, b) => a.order - b.order);

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl space-y-6">
      <Card className="space-y-2 p-6">
        <h1 className="text-2xl font-bold">{title || 'Untitled form'}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {readOnly && (
          <p className="text-xs italic text-muted-foreground">
            Preview mode — answers won&apos;t be saved.
          </p>
        )}
      </Card>

      {sorted.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No questions yet. Add questions from the builder to see them here.
        </Card>
      ) : (
        sorted.map((q, i) => (
          <QuestionInput
            key={q.id}
            question={q}
            index={i}
            value={answers[q.id]}
            error={errors[q.id]}
            disabled={readOnly || submitting}
            onChange={(v) => setAnswer(q.id, v)}
          />
        ))
      )}

      {sorted.length > 0 && (
        <div className="flex justify-end">
          <Button type="submit" disabled={readOnly || submitting}>
            {submitting ? 'Submitting…' : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

interface QuestionInputProps {
  question: FormQuestionData;
  index: number;
  value: Answer;
  error?: string;
  disabled?: boolean;
  onChange: (value: Answer) => void;
}

function QuestionInput({ question, index, value, error, disabled, onChange }: QuestionInputProps) {
  return (
    <Card className={cn('space-y-3 p-5', error && 'border-destructive')}>
      <Label htmlFor={`q-${question.id}`} className="flex items-start gap-2 text-base">
        <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span>
        <span className="font-medium">
          {question.label || <span className="italic text-muted-foreground">Untitled</span>}
          {question.required && <span className="ml-1 text-destructive">*</span>}
        </span>
      </Label>

      {question.type === 'short_text' && (
        <Input
          id={`q-${question.id}`}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          maxLength={500}
        />
      )}

      {question.type === 'long_text' && (
        <Textarea
          id={`q-${question.id}`}
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          maxLength={5000}
        />
      )}

      {question.type === 'single_choice' && (
        <div className="space-y-2">
          {(question.options ?? []).map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                value={opt}
                checked={value === opt}
                disabled={disabled}
                onChange={() => onChange(opt)}
                className="h-4 w-4 accent-primary"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'multi_choice' && (
        <div className="space-y-2">
          {(question.options ?? []).map((opt) => {
            const current = Array.isArray(value) ? value : [];
            const checked = current.includes(opt);
            return (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
              >
                <input
                  type="checkbox"
                  value={opt}
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...current, opt]);
                    } else {
                      onChange(current.filter((c) => c !== opt));
                    }
                  }}
                  className="h-4 w-4 accent-primary"
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {question.type === 'rating' && (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = typeof value === 'number' && value >= n;
            return (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => onChange(n)}
                className={cn(
                  'h-10 w-10 rounded-md border text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-muted'
                )}
                aria-label={`Rate ${n} out of 5`}
              >
                {n}
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'yes_no' && (
        <div className="flex gap-2">
          {['Yes', 'No'].map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt)}
              className={cn(
                'h-9 min-w-[80px] rounded-md border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                value === opt
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-muted'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </Card>
  );
}
