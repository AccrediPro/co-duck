'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AudioUpload } from './audio-upload';
import { TranscriptPaste } from './transcript-paste';
import { StructuredNotesEditor } from './structured-notes-editor';
import { STATUS_LABEL, type AiNotesData, type AiProcessingStatus } from './types';

interface AiNotesCardProps {
  sessionId: number;
}

const POLL_INTERVAL_MS = 3000;
const TERMINAL_STATUSES: AiProcessingStatus[] = ['ready', 'failed', 'idle'];

/**
 * "AI Notes" card rendered on the coach-side session detail page.
 *
 * Flow:
 *   - Initial load fetches current note (if any) via GET
 *   - If no note: shows Upload recording + Paste transcript tabs
 *   - After POST: polls GET every few seconds until status is terminal
 *   - When `ready`: renders StructuredNotesEditor for review/edit/send
 */
export function AiNotesCard({ sessionId }: AiNotesCardProps) {
  const [data, setData] = useState<AiNotesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNotes = useCallback(async (): Promise<AiNotesData | null> => {
    try {
      const res = await fetch(`/api/bookings/${sessionId}/ai-notes`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to load AI notes');
      }
      setError(null);
      setData(json.data as AiNotesData);
      return json.data as AiNotesData;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load AI notes';
      setError(msg);
      return null;
    }
  }, [sessionId]);

  const refresh = useCallback(async () => {
    await fetchNotes();
  }, [fetchNotes]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchNotes();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchNotes]);

  // Polling while processing is in flight
  useEffect(() => {
    if (!data) return;
    if (TERMINAL_STATUSES.includes(data.processingStatus)) return;

    pollTimerRef.current = setTimeout(async () => {
      await fetchNotes();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [data, fetchNotes]);

  const startProcessing = useCallback(
    async (payload: { audioStoragePath?: string; transcript?: string }) => {
      const res = await fetch(`/api/bookings/${sessionId}/ai-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to start processing');
      }
      await fetchNotes();
    },
    [sessionId, fetchNotes]
  );

  const handleAudioUploaded = useCallback(
    async (storagePath: string) => {
      try {
        await startProcessing({ audioStoragePath: storagePath });
      } catch (err) {
        toast.error('Could not start transcription', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [startProcessing]
  );

  const handleTranscriptSubmit = useCallback(
    async (transcript: string) => {
      await startProcessing({ transcript });
    },
    [startProcessing]
  );

  const handleRetry = useCallback(async () => {
    setData((prev) => (prev ? { ...prev, processingStatus: 'idle' } : prev));
  }, []);

  const statusBanner = useMemo(() => {
    if (!data) return null;
    const status = data.processingStatus;

    if (status === 'ready') return null;
    if (status === 'idle' && !data.exists) return null;

    if (status === 'failed') {
      return (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Processing failed</p>
              {data.processingError && (
                <p className="mt-1 text-xs opacity-90">{data.processingError}</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleRetry}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>{STATUS_LABEL[status]}</span>
      </div>
    );
  }, [data, handleRetry]);

  const showInputTabs = useMemo(() => {
    if (!data) return false;
    const { processingStatus, exists } = data;
    if (processingStatus === 'ready' && exists) return false;
    return processingStatus === 'idle' || processingStatus === 'failed';
  }, [data]);

  const showEditor = data?.processingStatus === 'ready' || (data?.exists && data.aiGenerated);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Session Notes
            </CardTitle>
            <CardDescription className="mt-1">
              Upload a recording or paste a transcript to generate structured SOAP notes, key
              topics, action item suggestions, and a draft follow-up email.
            </CardDescription>
          </div>
          {data?.aiTokensUsed ? (
            <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {data.aiTokensUsed.toLocaleString()} tokens
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading AI notes…
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">{error}</div>
              <Button size="sm" variant="outline" onClick={refresh}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <>
            {statusBanner}

            {showInputTabs && (
              <Tabs defaultValue="audio">
                <TabsList>
                  <TabsTrigger value="audio">Upload recording</TabsTrigger>
                  <TabsTrigger value="transcript">Paste transcript</TabsTrigger>
                </TabsList>
                <TabsContent value="audio" className="mt-4">
                  <AudioUpload sessionId={sessionId} onUploaded={handleAudioUploaded} />
                </TabsContent>
                <TabsContent value="transcript" className="mt-4">
                  <TranscriptPaste onSubmit={handleTranscriptSubmit} />
                </TabsContent>
              </Tabs>
            )}

            {showEditor && data && (
              <StructuredNotesEditor sessionId={sessionId} data={data} onRefresh={refresh} />
            )}

            <p className="text-[11px] leading-snug text-muted-foreground">
              Privacy: recordings are stored in a private bucket and automatically deleted after
              transcription. Notes are visible only to you — never shared with the client unless you
              explicitly send the follow-up email.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
