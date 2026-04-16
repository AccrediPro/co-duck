'use client';

import { useRef, useState } from 'react';
import { FileAudio, Loader2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const ALLOWED_EXTENSIONS = ['mp3', 'm4a', 'wav', 'webm', 'mp4'];
const MAX_BYTES = 25 * 1024 * 1024;

interface AudioUploadProps {
  sessionId: number;
  disabled?: boolean;
  onUploaded: (storagePath: string) => void | Promise<void>;
}

/**
 * Drag-and-drop / click-to-pick audio uploader.
 * Shows a progress bar during upload and validates extension + size client-side
 * before hitting the server.
 */
export function AudioUpload({ sessionId, disabled, onUploaded }: AudioUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || disabled) return;
    const file = files[0];

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      toast.error(`Unsupported file type (.${extension})`, {
        description: `Allowed: ${ALLOWED_EXTENSIONS.map((e) => '.' + e).join(', ')}`,
      });
      return;
    }

    if (file.size > MAX_BYTES) {
      toast.error('File too large', {
        description: `Max 25 MB (got ${Math.round(file.size / 1_000_000)} MB)`,
      });
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bookingId', String(sessionId));

      const res = await fetch('/api/upload/session-recording', {
        method: 'POST',
        body: formData,
      });

      setProgress(85);

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Upload failed');
      }

      setProgress(100);
      toast.success('Recording uploaded', {
        description: 'Transcription will start in a moment.',
      });
      await onUploaded(json.data.storagePath);
    } catch (err) {
      toast.error('Upload failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 600);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={`audio-upload-${sessionId}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
        } ${disabled || uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          id={`audio-upload-${sessionId}`}
          type="file"
          accept=".mp3,.m4a,.wav,.webm,.mp4,audio/*,video/mp4,video/webm"
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : (
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">
            {uploading ? 'Uploading…' : 'Drag a recording here or click to pick a file'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP3, M4A, WAV, WebM, MP4 • up to 25 MB
          </p>
        </div>
      </label>

      {uploading && (
        <div className="space-y-1">
          <Progress value={progress} />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileAudio className="h-3.5 w-3.5" />
            Uploading to secure storage…
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </Button>
        <span>Recordings are auto-deleted after transcription for privacy.</span>
      </div>
    </div>
  );
}
