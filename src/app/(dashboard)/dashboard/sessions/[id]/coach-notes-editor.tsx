'use client';

import { useState, useCallback } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { saveCoachNotes } from '../actions';

interface CoachNotesEditorProps {
  sessionId: number;
  initialNotes: string | null;
}

export function CoachNotesEditor({ sessionId, initialNotes }: CoachNotesEditorProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(initialNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await saveCoachNotes(sessionId, notes);

      if (result.success) {
        toast({
          title: 'Notes saved',
          description: 'Your notes have been saved successfully.',
        });
        setHasChanges(false);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save notes',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSaving(false);
    }
  }, [sessionId, notes, toast]);

  const handleBlur = useCallback(() => {
    if (hasChanges) {
      handleSave();
    }
  }, [hasChanges, handleSave]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Your Notes</CardTitle>
            <CardDescription>
              Private notes about this session (only visible to you)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Add notes about this session..."
          value={notes}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={5}
          className="resize-y"
        />
        {hasChanges && (
          <p className="mt-2 text-xs text-muted-foreground">
            Unsaved changes - will auto-save on blur or click Save
          </p>
        )}
      </CardContent>
    </Card>
  );
}
