'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { ArrowLeft, Eye, PencilLine, Save, Share, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { QuestionPalette } from './question-palette';
import { QuestionCard } from './question-card';
import { FormRunner } from '../form-runner';
import type { FormQuestionData, FormType, QuestionType } from '@/lib/validators/forms';
import { FORM_TYPES } from '@/lib/validators/forms';

export interface FormBuilderInitial {
  id: number | null;
  title: string;
  description: string | null;
  formType: FormType;
  questions: FormQuestionData[];
  isPublished: boolean;
}

interface FormBuilderCanvasProps {
  initial: FormBuilderInitial;
}

const NEEDS_OPTIONS: QuestionType[] = ['single_choice', 'multi_choice'];

function makeQuestionId(): string {
  // RFC 4122-ish v4 UUID using crypto if available, else fallback.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function defaultQuestion(type: QuestionType, order: number): FormQuestionData {
  return {
    id: makeQuestionId(),
    order,
    type,
    label: '',
    required: false,
    options: NEEDS_OPTIONS.includes(type) ? ['Option 1', 'Option 2'] : undefined,
  };
}

export function FormBuilderCanvas({ initial }: FormBuilderCanvasProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? '');
  const [formType, setFormType] = useState<FormType>(initial.formType);
  const [questions, setQuestions] = useState<FormQuestionData[]>(() =>
    [...initial.questions].sort((a, b) => a.order - b.order)
  );
  const [isPublished, setIsPublished] = useState(initial.isPublished);
  const [formId, setFormId] = useState<number | null>(initial.id);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const markDirty = () => setDirty(true);

  const handleAddQuestion = (type: QuestionType) => {
    setQuestions((prev) => {
      const next = [...prev, defaultQuestion(type, prev.length)];
      return next;
    });
    markDirty();
  };

  const handleUpdateQuestion = (q: FormQuestionData) => {
    setQuestions((prev) => prev.map((existing) => (existing.id === q.id ? q : existing)));
    markDirty();
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id).map((q, i) => ({ ...q, order: i })));
    markDirty();
  };

  const handleMove = (id: string, direction: -1 | 1) => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      if (idx < 0) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = arrayMove(prev, idx, target);
      return next.map((q, i) => ({ ...q, order: i }));
    });
    markDirty();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setQuestions((prev) => {
      const oldIndex = prev.findIndex((q) => q.id === active.id);
      const newIndex = prev.findIndex((q) => q.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      return next.map((q, i) => ({ ...q, order: i }));
    });
    markDirty();
  };

  // Title is required for save
  const canSave = title.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        formType,
        questions: questions.map((q, i) => ({ ...q, order: i })),
      };

      if (formId == null) {
        // Create
        const res = await fetch('/api/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.error?.message ?? 'Failed to save form');
          return;
        }
        setFormId(json.data.id);
        setDirty(false);
        toast.success('Form created');
        router.replace(`/dashboard/forms/builder/${json.data.id}`);
      } else {
        const res = await fetch(`/api/forms/${formId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.error?.message ?? 'Failed to save form');
          return;
        }
        setDirty(false);
        toast.success('Saved');
      }
    } catch (err) {
      console.error('[form-builder] save error', err);
      toast.error('Network error while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!formId) {
      toast.error('Save the form first');
      return;
    }
    if (dirty) {
      toast.error('Save your changes first');
      return;
    }
    try {
      const res = await fetch(`/api/forms/${formId}/publish`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to toggle publish state');
        return;
      }
      setIsPublished(json.data.isPublished);
      toast.success(json.data.isPublished ? 'Form published' : 'Form unpublished');
    } catch (err) {
      console.error('[form-builder] publish error', err);
      toast.error('Network error');
    }
  };

  const handleDelete = async () => {
    if (!formId) {
      router.push('/dashboard/forms');
      return;
    }
    try {
      const res = await fetch(`/api/forms/${formId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to delete form');
        return;
      }
      toast.success('Form deleted');
      router.push('/dashboard/forms');
    } catch (err) {
      console.error('[form-builder] delete error', err);
      toast.error('Network error while deleting');
    }
  };

  const previewQuestions = useMemo(
    () => questions.map((q, i) => ({ ...q, order: i })),
    [questions]
  );

  const canEditStructure = !isPublished;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/forms')}>
          <ArrowLeft className="h-4 w-4" /> Back to forms
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isPublished ? (
            <Badge variant="default">Published</Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
          {dirty && <Badge variant="outline">Unsaved changes</Badge>}
          <Button variant="outline" size="sm" onClick={handleSave} disabled={!canSave}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant={isPublished ? 'secondary' : 'default'}
            size="sm"
            onClick={handleTogglePublish}
            disabled={!formId || dirty || questions.length === 0}
          >
            <Share className="h-4 w-4" /> {isPublished ? 'Unpublish' : 'Publish'}
          </Button>
          {formId && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this form?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This also deletes all submitted responses. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">
            <PencilLine className="h-4 w-4" /> Edit
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4" /> Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-6">
          {/* Form metadata */}
          <Card className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="form-title">Title</Label>
              <Input
                id="form-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. New client intake"
                maxLength={200}
                disabled={!canEditStructure}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-description">Description</Label>
              <Textarea
                id="form-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  markDirty();
                }}
                placeholder="Shown to clients before they start answering"
                maxLength={1000}
                rows={3}
                disabled={!canEditStructure}
              />
            </div>
            <div className="space-y-2">
              <Label>Form type</Label>
              <Select
                value={formType}
                onValueChange={(v) => {
                  setFormType(v as FormType);
                  markDirty();
                }}
                disabled={!canEditStructure}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Two-pane builder */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              {questions.length === 0 ? (
                <Card className="border-dashed p-10 text-center">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Start by adding a question from the palette.
                  </p>
                </Card>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={questions.map((q) => q.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {questions.map((q, i) => (
                        <QuestionCard
                          key={q.id}
                          question={q}
                          index={i}
                          total={questions.length}
                          disabled={!canEditStructure}
                          onChange={handleUpdateQuestion}
                          onRemove={() => handleRemoveQuestion(q.id)}
                          onMove={(d) => handleMove(q.id, d)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
            <aside className="md:sticky md:top-4 md:h-fit">
              <QuestionPalette onAdd={handleAddQuestion} disabled={!canEditStructure} />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <FormRunner
            title={title || 'Untitled form'}
            description={description || null}
            questions={previewQuestions}
            readOnly
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
