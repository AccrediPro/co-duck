'use client';

import {
  AlignLeft,
  CheckSquare,
  CircleDot,
  ListChecks,
  Star,
  Type,
  ToggleRight,
} from 'lucide-react';
import type { QuestionType } from '@/lib/validators/forms';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface QuestionTypeSpec {
  type: QuestionType;
  label: string;
  hint: string;
  icon: typeof Type;
}

export const QUESTION_TYPE_SPECS: QuestionTypeSpec[] = [
  {
    type: 'short_text',
    label: 'Short text',
    hint: 'Name, email, phone — single line',
    icon: Type,
  },
  {
    type: 'long_text',
    label: 'Long text',
    hint: 'Stories, goals, symptoms',
    icon: AlignLeft,
  },
  {
    type: 'single_choice',
    label: 'Single choice',
    hint: 'Radio buttons — pick one',
    icon: CircleDot,
  },
  {
    type: 'multi_choice',
    label: 'Multi choice',
    hint: 'Checkboxes — pick any',
    icon: CheckSquare,
  },
  {
    type: 'rating',
    label: 'Rating scale',
    hint: '1-5 stars or 1-10 scale',
    icon: Star,
  },
  {
    type: 'yes_no',
    label: 'Yes / No',
    hint: 'Binary answer',
    icon: ToggleRight,
  },
];

interface QuestionPaletteProps {
  onAdd: (type: QuestionType) => void;
  disabled?: boolean;
}

/**
 * Sidebar palette shown inside the form builder. Coach clicks a question type
 * to append a new question to the canvas. Intentionally click-based (not DnD
 * from palette) — the canvas handles DnD reordering of existing questions.
 */
export function QuestionPalette({ onAdd, disabled }: QuestionPaletteProps) {
  return (
    <Card className="p-3 md:p-4">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Add a question</h3>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {QUESTION_TYPE_SPECS.map((spec) => {
          const Icon = spec.icon;
          return (
            <Button
              key={spec.type}
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 px-3 py-2 text-left"
              disabled={disabled}
              onClick={() => onAdd(spec.type)}
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex flex-col items-start">
                <span className="text-sm font-medium">{spec.label}</span>
                <span className="text-xs font-normal text-muted-foreground">{spec.hint}</span>
              </span>
            </Button>
          );
        })}
      </div>
      {disabled && (
        <p className="mt-3 text-xs text-muted-foreground">
          Unpublish the form to add or edit questions.
        </p>
      )}
    </Card>
  );
}
