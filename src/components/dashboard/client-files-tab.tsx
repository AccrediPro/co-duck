'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Trash2,
  Download,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Attachment {
  id: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  programId: number | null;
  goalId: number | null;
  actionItemId: number | null;
  createdAt: string;
}

interface Program {
  id: number;
  title: string;
}

interface ClientFilesTabProps {
  programs: Program[];
}

function getFileIcon(fileType: string) {
  if (fileType === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
  if (fileType.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-blue-500" />;
  return <FileIcon className="h-5 w-5 text-gray-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClientFilesTab({ programs }: ClientFilesTabProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploadProgramId, setUploadProgramId] = useState<string>('');

  const loadAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const allAttachments: Attachment[] = [];
      // Fetch attachments for each program
      for (const program of programs) {
        const res = await fetch(`/api/attachments?programId=${program.id}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          allAttachments.push(...json.data);
        }
      }
      // Deduplicate by id
      const unique = Array.from(new Map(allAttachments.map((a) => [a.id, a])).values());
      unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAttachments(unique);
    } catch {
      toast({ title: 'Error', description: 'Failed to load files', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs.length]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!uploadProgramId) {
      toast({ title: 'Select a program', description: 'You must select a program before uploading a file.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('programId', uploadProgramId);

      const res = await fetch('/api/attachments/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        setAttachments((prev) => [json.data, ...prev]);
        toast({ title: 'File uploaded', description: file.name });
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'Failed to upload file',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
        toast({ title: 'File deleted' });
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'Failed to delete file',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const getProgramTitle = (programId: number | null) => {
    if (!programId) return null;
    return programs.find((p) => p.id === programId)?.title || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Upload a file</label>
              <Select value={uploadProgramId} onValueChange={setUploadProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                onChange={handleUpload}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !uploadProgramId || programs.length === 0}
                size="sm"
              >
                {uploading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1 h-4 w-4" />
                )}
                Upload
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Supported formats: PDF, JPEG, PNG, WebP, DOC, DOCX. Max 10MB.
          </p>
        </CardContent>
      </Card>

      {/* Files list */}
      {attachments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Paperclip className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No files</p>
            <p className="text-sm text-muted-foreground">
              Upload the first file for this client.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const programTitle = getProgramTitle(attachment.programId);
            return (
              <Card key={attachment.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  {getFileIcon(attachment.fileType)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(attachment.fileSize)}</span>
                      {programTitle && (
                        <Badge variant="outline" className="text-xs">
                          {programTitle}
                        </Badge>
                      )}
                      <span>
                        {format(new Date(attachment.createdAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      disabled={deletingId === attachment.id}
                      onClick={() => handleDelete(attachment.id)}
                    >
                      {deletingId === attachment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
