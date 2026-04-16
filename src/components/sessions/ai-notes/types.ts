/**
 * @fileoverview Shared types for the AI Session Notes UI (P0-10)
 */

export type AiProcessingStatus =
  | 'idle'
  | 'uploading'
  | 'transcribing'
  | 'generating'
  | 'ready'
  | 'failed';

export interface AiNotesData {
  exists: boolean;
  processingStatus: AiProcessingStatus;
  processingError?: string | null;
  aiGenerated?: boolean;
  aiModel?: string | null;
  aiGeneratedAt?: string | Date | null;
  aiTokensUsed?: number | null;
  transcript?: string | null;
  soapSubjective?: string | null;
  soapObjective?: string | null;
  soapAssessment?: string | null;
  soapPlan?: string | null;
  keyTopics?: string[] | null;
  actionItemsSuggested?: string[] | null;
  nextSessionSuggestions?: string | null;
  followUpEmailSubject?: string | null;
  followUpEmailBody?: string | null;
  content?: string | null;
}

export const STATUS_LABEL: Record<AiProcessingStatus, string> = {
  idle: 'Ready to start',
  uploading: 'Uploading recording…',
  transcribing: 'Transcribing audio…',
  generating: 'Generating structured notes…',
  ready: 'Notes ready for review',
  failed: 'Processing failed',
};
