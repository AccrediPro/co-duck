'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface TranscriptPasteProps {
  disabled?: boolean;
  onSubmit: (transcript: string) => Promise<void>;
}

const MIN_TRANSCRIPT_LENGTH = 80;

/**
 * Fallback input when the coach already has a transcript (from Zoom, Otter.ai, etc).
 * Pastes raw text and triggers summarization directly — skips Whisper.
 */
export function TranscriptPaste({ disabled, onSubmit }: TranscriptPasteProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const tooShort = value.trim().length > 0 && value.trim().length < MIN_TRANSCRIPT_LENGTH;

  async function handle() {
    const trimmed = value.trim();
    if (trimmed.length < MIN_TRANSCRIPT_LENGTH) {
      toast.error('Transcript too short', {
        description: `Paste at least ${MIN_TRANSCRIPT_LENGTH} characters.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setValue('');
    } catch (err) {
      toast.error('Could not start generation', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        rows={8}
        placeholder="Paste the session transcript here (e.g. from Zoom, Google Meet, or Otter.ai)…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled || submitting}
        className="resize-y"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {value.trim().length === 0
            ? 'No audio upload? Paste an existing transcript to skip Whisper.'
            : tooShort
              ? `At least ${MIN_TRANSCRIPT_LENGTH} characters required`
              : `${value.trim().length.toLocaleString()} characters ready`}
        </p>
        <Button
          type="button"
          onClick={handle}
          disabled={disabled || submitting || tooShort || value.trim().length === 0}
          size="sm"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Starting…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Generate structured notes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
