'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Mail, Plus, Send, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { AiNotesData } from './types';

interface StructuredNotesEditorProps {
  sessionId: number;
  data: AiNotesData;
  onRefresh: () => Promise<void>;
}

/**
 * Editable view of AI-generated structured notes.
 * Coach can tweak every SOAP section, curate key topics + action item
 * suggestions, edit the draft follow-up email, then:
 *   1. Save edits back to session_notes (PATCH)
 *   2. Convert selected action item suggestions → real action_items rows
 *   3. Send the follow-up email to the client (Resend)
 */
export function StructuredNotesEditor({ sessionId, data, onRefresh }: StructuredNotesEditorProps) {
  const [subjective, setSubjective] = useState(data.soapSubjective ?? '');
  const [objective, setObjective] = useState(data.soapObjective ?? '');
  const [assessment, setAssessment] = useState(data.soapAssessment ?? '');
  const [plan, setPlan] = useState(data.soapPlan ?? '');
  const [topics, setTopics] = useState<string[]>(data.keyTopics ?? []);
  const [topicDraft, setTopicDraft] = useState('');
  const [suggestedItems, setSuggestedItems] = useState<string[]>(data.actionItemsSuggested ?? []);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [nextSuggestions, setNextSuggestions] = useState(data.nextSessionSuggestions ?? '');
  const [emailSubject, setEmailSubject] = useState(data.followUpEmailSubject ?? '');
  const [emailBody, setEmailBody] = useState(data.followUpEmailBody ?? '');

  const [saving, setSaving] = useState(false);
  const [creatingItems, setCreatingItems] = useState(false);
  const [sending, setSending] = useState(false);

  function toggleSuggestion(title: string) {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  function addTopic() {
    const t = topicDraft.trim();
    if (!t || topics.includes(t)) {
      setTopicDraft('');
      return;
    }
    setTopics([...topics, t]);
    setTopicDraft('');
  }

  function removeTopic(t: string) {
    setTopics(topics.filter((x) => x !== t));
  }

  async function saveEdits() {
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${sessionId}/ai-notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soapSubjective: subjective,
          soapObjective: objective,
          soapAssessment: assessment,
          soapPlan: plan,
          keyTopics: topics,
          actionItemsSuggested: suggestedItems,
          nextSessionSuggestions: nextSuggestions,
          followUpEmailSubject: emailSubject,
          followUpEmailBody: emailBody,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to save');
      }
      toast.success('Notes saved');
      await onRefresh();
    } catch (err) {
      toast.error('Could not save', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function createActionItems() {
    const titles = Array.from(selectedSuggestions);
    if (titles.length === 0) {
      toast.info('Select at least one suggestion first');
      return;
    }
    setCreatingItems(true);
    try {
      const res = await fetch(`/api/bookings/${sessionId}/ai-notes/action-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to create action items');
      }
      toast.success(
        `Created ${titles.length} action item${titles.length === 1 ? '' : 's'} for the client`
      );
      setSuggestedItems((prev) => prev.filter((s) => !selectedSuggestions.has(s)));
      setSelectedSuggestions(new Set());
      await onRefresh();
    } catch (err) {
      toast.error('Could not create action items', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setCreatingItems(false);
    }
  }

  async function sendFollowUp() {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error('Email draft is incomplete');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/bookings/${sessionId}/ai-notes/send-follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: emailSubject, body: emailBody }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? 'Failed to send email');
      }
      toast.success('Follow-up email sent to client');
    } catch (err) {
      toast.error('Could not send', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-gold/40 bg-gold/5 p-3 text-sm text-burgundy-dark dark:border-gold-dark dark:bg-gold-dark/10 dark:text-gold">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium">Processed by AI</span> — review and edit before saving or
            sending. These notes are private to you; nothing is shared with the client until you
            explicitly send the follow-up email.
          </p>
        </div>
      </div>

      {/* SOAP sections */}
      <div className="space-y-4">
        <SoapField
          id="soap-s"
          label="Subjective"
          hint="Client's self-reported state, concerns, symptoms."
          value={subjective}
          onChange={setSubjective}
        />
        <SoapField
          id="soap-o"
          label="Objective"
          hint="Observable data, metrics tracked, behavior."
          value={objective}
          onChange={setObjective}
        />
        <SoapField
          id="soap-a"
          label="Assessment"
          hint="Your impression — patterns, what's working, what's stuck."
          value={assessment}
          onChange={setAssessment}
        />
        <SoapField
          id="soap-p"
          label="Plan"
          hint="Plan for the client between now and next session."
          value={plan}
          onChange={setPlan}
        />
      </div>

      <Separator />

      {/* Key topics */}
      <div className="space-y-2">
        <Label>Key topics</Label>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1.5 py-1 pl-3 pr-1.5">
              {t}
              <button
                type="button"
                onClick={() => removeTopic(t)}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-background/50"
                aria-label={`Remove ${t}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {topics.length === 0 && (
            <p className="text-xs text-muted-foreground">No topics yet. Add some below.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={topicDraft}
            onChange={(e) => setTopicDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTopic();
              }
            }}
            placeholder="Add a topic and press Enter…"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTopic}
            disabled={!topicDraft.trim()}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>

      <Separator />

      {/* Suggested action items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>Suggested action items</Label>
            <p className="text-xs text-muted-foreground">
              Select the ones you want to assign to the client.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={createActionItems}
            disabled={selectedSuggestions.size === 0 || creatingItems}
          >
            {creatingItems ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Assign {selectedSuggestions.size || ''} to client
          </Button>
        </div>
        {suggestedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pending suggestions. Create action items manually from the action items page.
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestedItems.map((item) => {
              const selected = selectedSuggestions.has(item);
              return (
                <li key={item}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                      selected
                        ? 'border-primary/60 bg-primary/5'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSuggestion(item)}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span className="flex-1 text-sm leading-relaxed">{item}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Separator />

      {/* Next session */}
      <div className="space-y-2">
        <Label htmlFor="next-suggestions">Next session suggestions</Label>
        <Textarea
          id="next-suggestions"
          rows={3}
          value={nextSuggestions}
          onChange={(e) => setNextSuggestions(e.target.value)}
          placeholder="Topics to revisit, questions to probe, assessments to run…"
        />
      </div>

      <Separator />

      {/* Follow-up email draft */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <Label className="text-base">Follow-up email draft</Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-subject">Subject</Label>
          <Input
            id="email-subject"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder="A warm subject line…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-body">Body</Label>
          <Textarea
            id="email-body"
            rows={10}
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="The email the client will receive — review and edit before sending."
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Nothing is sent until you click <span className="font-medium">Send to client</span>.
        </p>
      </div>

      {/* Footer actions */}
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={saveEdits} disabled={saving} type="button">
          {saving ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            'Save edits'
          )}
        </Button>
        <Button type="button" onClick={sendFollowUp} disabled={sending}>
          {sending ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Send follow-up email to client
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function SoapField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-semibold">
          {label}
        </Label>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <Textarea
        id={id}
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint}
      />
    </div>
  );
}
