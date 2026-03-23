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
  'Cosa vorresti ottenere dalla sessione di oggi?',
  'C\'è qualcosa di specifico che vorresti discutere?',
  'Come ti senti riguardo ai tuoi progressi dall\'ultima sessione?',
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
        title: 'Errore',
        description: 'Impossibile caricare le domande di preparazione.',
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
        title: 'Errore',
        description: `Servono almeno ${MIN_QUESTIONS} domande.`,
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
        throw new Error(result.error?.message || 'Salvataggio fallito');
      }

      setQuestions(result.data.questions);
      setOriginalQuestions(result.data.questions);
      toast({
        title: 'Domande salvate',
        description: 'Le domande di preparazione sono state aggiornate.',
      });
    } catch (err) {
      toast({
        title: 'Errore',
        description: err instanceof Error ? err.message : 'Salvataggio fallito',
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
            Domande di Preparazione
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
          Domande di Preparazione
        </CardTitle>
        <CardDescription>
          Domande inviate ai clienti prima di ogni sessione per aiutarli a prepararsi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((question, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor={`prep-config-q-${index}`} className="text-xs text-muted-foreground">
                Domanda {index + 1}
              </Label>
              <Input
                id={`prep-config-q-${index}`}
                placeholder="Scrivi la domanda..."
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
                aria-label={`Rimuovi domanda ${index + 1}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}

        {questions.length < MAX_QUESTIONS && (
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="mr-2 h-4 w-4" />
            Aggiungi domanda
          </Button>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Ripristina default
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
            Salva
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
