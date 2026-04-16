'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, X } from 'lucide-react';
import type { FormQuestionData, QuestionType } from '@/lib/validators/forms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { QUESTION_TYPE_SPECS } from './question-palette';
import { cn } from '@/lib/utils';

interface QuestionCardProps {
  question: FormQuestionData;
  index: number;
  total: number;
  disabled?: boolean;
  onChange: (q: FormQuestionData) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}

const NEEDS_OPTIONS: QuestionType[] = ['single_choice', 'multi_choice'];

/**
 * Inline editable question card. Sortable via @dnd-kit.
 */
export function QuestionCard({
  question,
  index,
  total,
  disabled,
  onChange,
  onRemove,
  onMove,
}: QuestionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const spec = QUESTION_TYPE_SPECS.find((s) => s.type === question.type);
  const Icon = spec?.icon;
  const showOptions = NEEDS_OPTIONS.includes(question.type);

  const updateOption = (idx: number, value: string) => {
    const next = [...(question.options ?? [])];
    next[idx] = value;
    onChange({ ...question, options: next });
  };

  const removeOption = (idx: number) => {
    const next = (question.options ?? []).filter((_, i) => i !== idx);
    onChange({ ...question, options: next });
  };

  const addOption = () => {
    const next = [...(question.options ?? []), `Option ${(question.options?.length ?? 0) + 1}`];
    onChange({ ...question, options: next });
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative border p-4 transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-primary/30'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle + reorder */}
        <div className="flex flex-col items-center gap-1 pt-1 text-muted-foreground">
          <button
            type="button"
            aria-label="Drag to reorder"
            className={cn(
              'cursor-grab touch-none rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
              isDragging && 'cursor-grabbing'
            )}
            disabled={disabled}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex flex-col">
            <button
              type="button"
              aria-label="Move up"
              className="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              disabled={disabled || index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              aria-label="Move down"
              className="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              disabled={disabled || index === total - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDown className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-2 py-0.5 font-mono">#{index + 1}</span>
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{spec?.label}</span>
          </div>

          <div className="space-y-1">
            <Label htmlFor={`q-${question.id}-label`} className="text-xs">
              Question
            </Label>
            <Input
              id={`q-${question.id}-label`}
              value={question.label}
              placeholder="What would you like to ask?"
              disabled={disabled}
              onChange={(e) => onChange({ ...question, label: e.target.value })}
              maxLength={500}
            />
          </div>

          {showOptions && (
            <div className="space-y-2">
              <Label className="text-xs">Options</Label>
              <div className="space-y-2">
                {(question.options ?? []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opt}
                      placeholder={`Option ${i + 1}`}
                      disabled={disabled}
                      onChange={(e) => updateOption(i, e.target.value)}
                      maxLength={200}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove option"
                      disabled={disabled || (question.options?.length ?? 0) <= 2}
                      onClick={() => removeOption(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || (question.options?.length ?? 0) >= 20}
                onClick={addOption}
              >
                <Plus className="h-3.5 w-3.5" /> Add option
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <Switch
                id={`q-${question.id}-required`}
                checked={question.required}
                disabled={disabled}
                onCheckedChange={(v) => onChange({ ...question, required: v })}
              />
              <Label htmlFor={`q-${question.id}-required`} className="text-xs">
                Required
              </Label>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={onRemove}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
