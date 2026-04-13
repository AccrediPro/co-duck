'use client';

import { useState, useCallback, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { saveSessionNote, getSessionNoteTemplates } from '../actions';
import { TemplateManagerDialog } from '@/components/sessions/template-manager-dialog';

interface TemplateSection {
  title: string;
  placeholder: string;
}

interface Template {
  id: number;
  name: string;
  sections: TemplateSection[];
}

interface CoachNotesEditorProps {
  sessionId: number;
  initialNotes: string | null;
  initialTemplateId?: number | null;
  initialSections?: Record<string, string> | null;
}

export function CoachNotesEditor({
  sessionId,
  initialNotes,
  initialTemplateId,
  initialSections,
}: CoachNotesEditorProps) {
  const { toast } = useToast();

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    initialTemplateId ?? null
  );

  // Notes state — free-text mode
  const [freeText, setFreeText] = useState(initialTemplateId ? '' : initialNotes || '');

  // Notes state — structured mode
  const [sectionData, setSectionData] = useState<Record<string, string>>(initialSections ?? {});

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Derived: the selected template object
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
  const isStructuredMode = selectedTemplate !== null;

  // Load templates on mount
  useEffect(() => {
    getSessionNoteTemplates().then((result) => {
      if (result.success && result.templates) {
        setTemplates(result.templates as Template[]);
      }
    });
  }, []);

  // Build concatenated content from structured sections
  const buildContentFromSections = useCallback(
    (template: Template, data: Record<string, string>) => {
      return template.sections
        .map((section) => {
          const content = data[section.title] || '';
          return `## ${section.title}\n${content}`;
        })
        .join('\n\n');
    },
    []
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      let content: string;
      let templateId: number | null = null;
      let sections: Record<string, string> | null = null;

      if (isStructuredMode && selectedTemplate) {
        content = buildContentFromSections(selectedTemplate, sectionData);
        templateId = selectedTemplate.id;
        sections = sectionData;
      } else {
        content = freeText;
      }

      const result = await saveSessionNote(sessionId, content, templateId, sections);

      if (result.success) {
        toast({ title: 'Notes saved', description: 'Your notes have been saved successfully.' });
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
  }, [
    sessionId,
    isStructuredMode,
    selectedTemplate,
    sectionData,
    freeText,
    buildContentFromSections,
    toast,
  ]);

  const handleBlur = useCallback(() => {
    if (hasChanges) {
      handleSave();
    }
  }, [hasChanges, handleSave]);

  const handleTemplateChange = (value: string) => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Switching templates will discard them. Continue?'
      );
      if (!confirmed) return;
    }

    if (value === 'free') {
      setSelectedTemplateId(null);
      setSectionData({});
      setHasChanges(false);
    } else {
      const newTemplateId = parseInt(value, 10);
      const template = templates.find((t) => t.id === newTemplateId);
      if (template) {
        setSelectedTemplateId(newTemplateId);
        // Initialize empty section data for new template
        const initialData: Record<string, string> = {};
        template.sections.forEach((s) => {
          initialData[s.title] = '';
        });
        setSectionData(initialData);
        setHasChanges(false);
      }
    }
  };

  const handleSectionChange = (title: string, value: string) => {
    setSectionData((prev) => ({ ...prev, [title]: value }));
    setHasChanges(true);
  };

  const handleFreeTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFreeText(e.target.value);
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

      <CardContent className="space-y-4">
        {/* Template selector row */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Select
              value={selectedTemplateId ? String(selectedTemplateId) : 'free'}
              onValueChange={handleTemplateChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free text</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={String(template.id)}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TemplateManagerDialog
            onTemplatesChanged={() => {
              getSessionNoteTemplates().then((result) => {
                if (result.success && result.templates) {
                  setTemplates(result.templates as Template[]);
                }
              });
            }}
          />
        </div>

        {/* Notes area */}
        {isStructuredMode && selectedTemplate ? (
          <div className="space-y-4">
            {selectedTemplate.sections.map((section) => (
              <div key={section.title} className="space-y-1.5">
                <Label className="text-sm font-medium">{section.title}</Label>
                <Textarea
                  placeholder={section.placeholder || `Add notes for ${section.title}...`}
                  value={sectionData[section.title] || ''}
                  onChange={(e) => handleSectionChange(section.title, e.target.value)}
                  onBlur={handleBlur}
                  rows={3}
                  className="resize-y"
                />
              </div>
            ))}
          </div>
        ) : (
          <Textarea
            placeholder="Add notes about this session..."
            value={freeText}
            onChange={handleFreeTextChange}
            onBlur={handleBlur}
            rows={5}
            className="resize-y"
          />
        )}

        {hasChanges && (
          <p className="text-xs text-muted-foreground">
            Unsaved changes — will auto-save on blur or click Save
          </p>
        )}
      </CardContent>
    </Card>
  );
}
