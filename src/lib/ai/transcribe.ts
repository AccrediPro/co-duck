/**
 * @fileoverview Whisper Transcription (P0-10)
 *
 * Downloads an audio file from a URL (typically a signed Supabase Storage URL)
 * and sends it to OpenAI Whisper for transcription.
 *
 * @module lib/ai/transcribe
 */

import { getOpenAI } from './openai';

const TRANSCRIBE_MODEL = 'whisper-1';

/**
 * Maximum audio file size accepted by Whisper (25 MB per OpenAI docs).
 * @see https://platform.openai.com/docs/guides/speech-to-text
 */
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

export interface TranscribeResult {
  /** The raw transcript text */
  text: string;
  /** Audio duration in seconds (when available) */
  durationSeconds: number | null;
  /** Detected or hinted language code (e.g. 'en') */
  language: string | null;
}

export interface TranscribeOptions {
  /** Hint Whisper about the spoken language. Default: 'en'. */
  language?: string;
  /** Filename extension hint (Whisper needs a filename to infer format). */
  filename?: string;
}

/**
 * Downloads audio from `url` and transcribes it via Whisper.
 *
 * @param url - HTTPS URL to the audio file (mp3/m4a/wav/webm/mp4)
 * @param opts - Optional language hint and filename
 * @returns Transcript text with metadata
 * @throws {Error} When download fails, file exceeds limit, or Whisper errors
 */
export async function transcribeAudio(
  url: string,
  opts: TranscribeOptions = {}
): Promise<TranscribeResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download audio (${response.status} ${response.statusText})`);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > WHISPER_MAX_BYTES) {
    throw new Error(
      `Audio file is ${Math.round(Number(contentLength) / 1_000_000)}MB; Whisper accepts up to 25MB.`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > WHISPER_MAX_BYTES) {
    throw new Error(
      `Audio file is ${Math.round(arrayBuffer.byteLength / 1_000_000)}MB; Whisper accepts up to 25MB.`
    );
  }

  const filename = opts.filename ?? inferFilename(url);
  const audioFile = new File([arrayBuffer], filename, {
    type: response.headers.get('content-type') ?? 'audio/mpeg',
  });

  const openai = getOpenAI();
  const result = await openai.audio.transcriptions.create({
    file: audioFile,
    model: TRANSCRIBE_MODEL,
    language: opts.language ?? 'en',
    response_format: 'verbose_json',
  });

  return {
    text: result.text.trim(),
    durationSeconds:
      typeof (result as { duration?: number }).duration === 'number'
        ? (result as { duration: number }).duration
        : null,
    language:
      typeof (result as { language?: string }).language === 'string'
        ? (result as { language: string }).language
        : null,
  };
}

/**
 * Picks a filename with a reasonable extension from a URL path.
 * Whisper uses the filename to detect the audio format.
 */
function inferFilename(url: string): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split('/').pop() ?? '';
    if (base && /\.(mp3|m4a|wav|webm|mp4|mpga|ogg|flac)$/i.test(base)) {
      return base;
    }
  } catch {
    // fall through
  }
  return 'session-recording.mp3';
}
