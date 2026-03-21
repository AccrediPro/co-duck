'use client';

import { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface Section {
  title: string;
  placeholder: string;
}

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editTemplate?: {
    id: number;
    name: string;
    description: string | null;
    sections: Array<{ title: string; placeholder: string }>;
  } | null;
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  onSaved,
  editTemplate,
}: TemplateFormDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(editTemplate?.name ?? '');
  const [description, setDescription] = useState(editTemplate?.description ?? '');
  const [sections, setSections] = useState<Section[]>(
    editTemplate?.sections?.length
      ? editTemplate.sections.map((s) => ({ title: s.title, placeholder: s.placeholder }))
      : [{ title: '', placeholder: '' }]
  );

  // Reset form state when dialog opens with different template
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setName(editTemplate?.name ?? '');
      setDescription(editTemplate?.description ?? '');
      setSections(
        editTemplate?.sections?.length
          ? editTemplate.sections.map((s) => ({ title: s.title, placeholder: s.placeholder }))
          : [{ title: '', placeholder: '' }]
      );
    }
    onOpenChange(newOpen);
  };

  const addSection = () => {
    setSections((prev) => [...prev, { title: '', placeholder: '' }]);
  };

  const removeSection = (index: number) => {
    if (sections.length <= 1) return;
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSection = (index: number, field: keyof Section, value: string) => {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Template name is required', variant: 'destructive' });
      return;
    }

    const validSections = sections.filter((s) => s.title.trim());
    if (validSections.length === 0) {
      toast({
        title: 'Error',
        description: 'At least one section with a title is required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const url = editTemplate
        ? `/api/session-note-templates/${editTemplate.id}`
        : '/api/session-note-templates';
      const method = editTemplate ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          sections: validSections,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to save template');
      }

      toast({
        title: editTemplate ? 'Template updated' : 'Template created',
        description: `"${name.trim()}" has been ${editTemplate ? 'updated' : 'created'} successfully.`,
      });

      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save template',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
          <DialogDescription>
            {editTemplate
              ? 'Update your custom note template.'
              : 'Create a structured template for your session notes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Name *</Label>
            <Input
              id="template-name"
              placeholder="e.g. Goal Setting Session"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="template-description">Description</Label>
            <Input
              id="template-description"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Sections */}
          <div className="space-y-2">
            <Label>Sections *</Label>
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div key={index} className="flex gap-2 rounded-md border p-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      placeholder="Section title (e.g. Key Insights)"
                      value={section.title}
                      onChange={(e) => updateSection(index, 'title', e.target.value)}
                    />
                    <Input
                      placeholder="Placeholder text (optional)"
                      value={section.placeholder}
                      onChange={(e) => updateSection(index, 'placeholder', e.target.value)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeSection(index)}
                    disabled={sections.length <= 1}
                    aria-label="Remove section"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addSection}
              type="button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Section
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editTemplate ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
