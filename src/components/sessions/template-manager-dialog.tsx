'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Settings2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { TemplateFormDialog } from './template-form-dialog';

interface Template {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  sections: Array<{ title: string; placeholder: string }>;
}

interface TemplateManagerDialogProps {
  onTemplatesChanged: () => void;
}

export function TemplateManagerDialog({ onTemplatesChanged }: TemplateManagerDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/session-note-templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data.templates);
      } else {
        throw new Error(data.error?.message || 'Failed to load templates');
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load templates',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/session-note-templates/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete template');
      }

      toast({
        title: 'Template deleted',
        description: `"${deleteTarget.name}" has been deleted.`,
      });

      setDeleteTarget(null);
      fetchTemplates();
      onTemplatesChanged();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete template',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormSaved = () => {
    fetchTemplates();
    onTemplatesChanged();
  };

  const openCreate = () => {
    setEditTemplate(null);
    setFormDialogOpen(true);
  };

  const openEdit = (template: Template) => {
    setEditTemplate(template);
    setFormDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings2 className="mr-2 h-4 w-4" />
            Manage Templates
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Note Templates</DialogTitle>
            <DialogDescription>
              Manage your session note templates. System templates are read-only.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Button variant="outline" size="sm" className="w-full" onClick={openCreate}>
              + Create New Template
            </Button>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No templates yet.</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{template.name}</span>
                          {template.isSystem && (
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              System
                            </Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {template.description}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {template.sections.length} section
                          {template.sections.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {!template.isSystem && (
                        <div className="ml-2 flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(template)}
                            aria-label={`Edit ${template.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(template)}
                            aria-label={`Delete ${template.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / Edit form dialog */}
      <TemplateFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        onSaved={handleFormSaved}
        editTemplate={editTemplate}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This won&apos;t affect existing notes that used this template. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
