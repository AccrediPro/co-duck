'use client';

/**
 * @fileoverview Quick Onboarding Form (P0-11)
 *
 * Client component that powers the one-page AI coach onboarding flow.
 *
 * Flow:
 * 1. Coach pastes a URL or free-form text → clicks "Generate with AI"
 * 2. We POST to `/api/onboarding/coach/ai-draft`, receive a `CoachDraft`
 * 3. The draft populates every field below, each inline-editable
 * 4. Coach reviews, accepts the AI consent disclaimer, and clicks Publish
 * 5. We POST to `/api/onboarding/coach/apply-draft` with the edited payload
 * 6. On success, redirect to `/coaches/:slug`
 *
 * This component keeps everything in local React state for snappy editing
 * (no auto-save between fields). The publish button is the only action that
 * writes to the DB.
 *
 * @module components/onboarding/quick-onboarding-form
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Trash2, Plus, Info, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

import {
  COACH_CATEGORIES,
  SESSION_DURATIONS,
  SUPPORTED_CURRENCIES,
} from '@/lib/validators/coach-onboarding';
import { TIMEZONES } from '@/lib/timezones';

/* ==========================================================================
   Local types — mirror the API contract but in the form's own shape
   ========================================================================== */

type CredentialType = 'certification' | 'degree' | 'license' | 'membership';

interface CredentialDraft {
  id?: string;
  type: CredentialType;
  title: string;
  issuer: string;
  issuedYear: number | null;
  credentialId?: string | null;
  verificationUrl?: string | null;
}

interface SessionTypeDraft {
  id?: string;
  name: string;
  duration: number;
  priceCents: number;
}

interface SpecialtyDraft {
  category: string;
  subNiches: string[];
}

interface DraftState {
  displayName: string;
  headline: string;
  profilePhotoUrl: string;
  timezone: string;
  bio: string;
  specialties: SpecialtyDraft[];
  currency: string;
  sessionTypes: SessionTypeDraft[];
  hourlyRateCents: number | null;
  credentials: CredentialDraft[];
}

interface ExistingProfile {
  headline: string;
  bio: string;
  specialties: SpecialtyDraft[];
  currency: string;
  sessionTypes: SessionTypeDraft[];
  hourlyRateCents: number | null;
  credentials: CredentialDraft[];
  timezone: string;
  isPublished: boolean;
}

export interface QuickOnboardingFormProps {
  aiAvailable: boolean;
  initialDisplayName: string;
  initialAvatarUrl: string;
  existingProfile: ExistingProfile | null;
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(v: string): number {
  const n = Number.parseFloat(v);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

function emptyDraft(initial: {
  displayName: string;
  profilePhotoUrl: string;
  existing: ExistingProfile | null;
}): DraftState {
  if (initial.existing) {
    return {
      displayName: initial.displayName,
      headline: initial.existing.headline,
      profilePhotoUrl: initial.profilePhotoUrl,
      timezone: initial.existing.timezone || getBrowserTimezone(),
      bio: initial.existing.bio,
      specialties: initial.existing.specialties.length
        ? initial.existing.specialties
        : [{ category: 'Life', subNiches: [] }],
      currency: initial.existing.currency,
      sessionTypes: initial.existing.sessionTypes.length
        ? initial.existing.sessionTypes
        : [{ name: '1:1 Session', duration: 60, priceCents: 10000 }],
      hourlyRateCents: initial.existing.hourlyRateCents,
      credentials: initial.existing.credentials,
    };
  }
  return {
    displayName: initial.displayName,
    headline: '',
    profilePhotoUrl: initial.profilePhotoUrl,
    timezone: getBrowserTimezone(),
    bio: '',
    specialties: [{ category: 'Life', subNiches: [] }],
    currency: 'USD',
    sessionTypes: [{ name: '1:1 Session', duration: 60, priceCents: 10000 }],
    hourlyRateCents: null,
    credentials: [],
  };
}

/* ==========================================================================
   Component
   ========================================================================== */

export function QuickOnboardingForm(props: QuickOnboardingFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(Boolean(props.existingProfile));
  const [sourceInfo, setSourceInfo] = useState<{
    url?: string;
    title?: string;
    truncated?: boolean;
  } | null>(null);

  const [draft, setDraft] = useState<DraftState>(() =>
    emptyDraft({
      displayName: props.initialDisplayName,
      profilePhotoUrl: props.initialAvatarUrl,
      existing: props.existingProfile,
    })
  );

  const [consented, setConsented] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, startPublishTransition] = useTransition();

  /* ---------- AI draft generation ---------- */

  async function handleGenerate() {
    setGenerateError(null);
    const hasUrl = sourceUrl.trim().length > 0;
    const hasText = sourceText.trim().length > 0;
    if (!hasUrl && !hasText) {
      setGenerateError('Paste a URL or at least a short bio to draft your profile.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/onboarding/coach/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrl: hasUrl ? sourceUrl.trim() : undefined,
          sourceText: hasText ? sourceText.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const message = json?.error?.message ?? 'Failed to generate profile draft.';
        setGenerateError(message);
        return;
      }

      const { draft: aiDraft, sourceInfo: info } = json.data as {
        draft: {
          headline: string;
          bio: string;
          specialties: SpecialtyDraft[];
          credentials: CredentialDraft[];
          sessionTypes: SessionTypeDraft[];
          hourlyRateCents: number | null;
          slugSuggestion: string;
        };
        sourceInfo: { url?: string; title?: string; truncated?: boolean };
      };

      setDraft((prev) => ({
        ...prev,
        headline: aiDraft.headline,
        bio: aiDraft.bio,
        specialties: aiDraft.specialties.length > 0 ? aiDraft.specialties : prev.specialties,
        credentials: aiDraft.credentials,
        sessionTypes: aiDraft.sessionTypes.length > 0 ? aiDraft.sessionTypes : prev.sessionTypes,
        hourlyRateCents: aiDraft.hourlyRateCents,
      }));
      setSourceInfo(info);
      setDraftReady(true);
      toast({
        title: 'Draft generated',
        description: 'Review every field below. You can edit anything before publishing.',
      });
    } catch (err) {
      setGenerateError((err as Error).message || 'Network error generating draft.');
    } finally {
      setIsGenerating(false);
    }
  }

  /* ---------- Publish ---------- */

  function validateBeforePublish(): string | null {
    if (!draft.displayName || draft.displayName.length < 2) {
      return 'Display name is required (at least 2 characters).';
    }
    if (!draft.headline || draft.headline.length < 10) {
      return 'Headline must be at least 10 characters.';
    }
    if (!draft.timezone) return 'Please select your timezone.';
    if (draft.specialties.length === 0) return 'Add at least one specialty.';
    if (draft.sessionTypes.length === 0) return 'Add at least one session type.';
    for (const st of draft.sessionTypes) {
      if (!st.name.trim()) return 'Every session type needs a name.';
      if (!(SESSION_DURATIONS as readonly number[]).includes(st.duration)) {
        return `Session "${st.name}" has an invalid duration.`;
      }
    }
    return null;
  }

  function handlePublish(publish: boolean) {
    setPublishError(null);
    const err = validateBeforePublish();
    if (err) {
      setPublishError(err);
      return;
    }
    if (publish && !consented) {
      setPublishError('Please confirm you have reviewed the AI-generated draft.');
      return;
    }

    startPublishTransition(async () => {
      try {
        const body = {
          displayName: draft.displayName,
          headline: draft.headline,
          profilePhotoUrl: draft.profilePhotoUrl || undefined,
          timezone: draft.timezone,
          bio: draft.bio,
          specialties: draft.specialties.filter((s) => s.category.trim().length > 0),
          currency: draft.currency,
          sessionTypes: draft.sessionTypes.map((st) => ({
            id: st.id,
            name: st.name.trim(),
            duration: st.duration,
            priceCents: st.priceCents,
          })),
          hourlyRateCents: draft.hourlyRateCents,
          credentials: draft.credentials
            .filter((c) => c.title.trim() && c.issuer.trim() && c.issuedYear)
            .map((c) => ({
              id: c.id,
              type: c.type,
              title: c.title.trim(),
              issuer: c.issuer.trim(),
              issuedYear: c.issuedYear,
              credentialId: c.credentialId || null,
              verificationUrl: c.verificationUrl || null,
            })),
          publish,
        };

        const res = await fetch('/api/onboarding/coach/apply-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setPublishError(json?.error?.message ?? 'Failed to save profile.');
          return;
        }

        const { slug, isPublished } = json.data as { slug: string; isPublished: boolean };
        toast({
          title: isPublished ? 'Profile published' : 'Profile saved',
          description: isPublished
            ? 'Your profile is now live on AccrediPro CoachHub.'
            : 'You can publish it anytime from your dashboard.',
        });
        if (isPublished) {
          router.push(`/coaches/${slug}`);
        } else {
          router.push('/dashboard/profile');
        }
      } catch (e) {
        setPublishError((e as Error).message || 'Network error while saving.');
      }
    });
  }

  /* ---------- Derived UI helpers ---------- */

  const currencySymbol = useMemo(
    () => SUPPORTED_CURRENCIES.find((c) => c.code === draft.currency)?.symbol ?? '$',
    [draft.currency]
  );

  /* ==========================================================================
     Render
     ========================================================================== */

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      {/* LEFT COLUMN — editable form */}
      <div className="space-y-6">
        {/* Source section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-burgundy-dark" aria-hidden />
              Draft my profile with AI
            </CardTitle>
            <CardDescription>
              Paste any one of: your LinkedIn profile URL, your personal website, or a short
              &ldquo;About me&rdquo; description. We&rsquo;ll generate a complete coach profile for
              you to edit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!props.aiAvailable && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>AI drafting unavailable</AlertTitle>
                <AlertDescription>
                  AI drafting is not configured on this environment. You can still fill in your
                  profile manually below, or use the{' '}
                  <a href="/onboarding/coach" className="underline">
                    step-by-step wizard
                  </a>
                  .
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="sourceUrl">Source URL (optional)</Label>
              <Input
                id="sourceUrl"
                type="url"
                placeholder="https://www.linkedin.com/in/yourname or https://yoursite.com"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                disabled={!props.aiAvailable || isGenerating}
              />
              <p className="text-xs text-muted-foreground">
                Public URLs work best. LinkedIn sometimes blocks scraping — if that happens, paste
                your &ldquo;About&rdquo; section below instead.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceText">&ldquo;About me&rdquo; text (optional)</Label>
              <Textarea
                id="sourceText"
                placeholder="Paste your bio, LinkedIn About section, or any text that describes your coaching work, credentials, and ideal client."
                rows={6}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                disabled={!props.aiAvailable || isGenerating}
              />
            </div>

            {generateError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{generateError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={!props.aiAvailable || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Drafting...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                Prefer a step-by-step form?{' '}
                <a href="/onboarding/coach" className="underline">
                  Use the classic wizard
                </a>
                .
              </span>
            </div>

            {sourceInfo && (
              <p className="text-xs text-muted-foreground">
                Source: {sourceInfo.title || sourceInfo.url || 'pasted text'}
                {sourceInfo.truncated ? ' (text was truncated to fit the model)' : ''}.
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI disclaimer — always visible once draft is loaded */}
        {draftReady && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Review every field before publishing</AlertTitle>
            <AlertDescription>
              This is an AI-generated draft. You are responsible for the accuracy of your profile —
              please review headline, bio, specialties, credentials, and prices before you publish.
            </AlertDescription>
          </Alert>
        )}

        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={draft.displayName}
                onChange={(e) => setDraft((d) => ({ ...d, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                value={draft.headline}
                onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))}
                placeholder="Executive Coach helping first-time founders lead with clarity"
              />
              <p className="text-xs text-muted-foreground">
                Shown under your name on the profile card. 10&ndash;150 characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profilePhotoUrl">Profile photo URL (optional)</Label>
              <Input
                id="profilePhotoUrl"
                type="url"
                placeholder="https://..."
                value={draft.profilePhotoUrl}
                onChange={(e) => setDraft((d) => ({ ...d, profilePhotoUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={draft.timezone}
                onValueChange={(v) => setDraft((d) => ({ ...d, timezone: v }))}
              >
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bio */}
        <Card>
          <CardHeader>
            <CardTitle>Bio</CardTitle>
            <CardDescription>
              Introduce yourself — your experience, approach, and who you love working with.
              50&ndash;2000 characters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={8}
              value={draft.bio}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
              placeholder="Share your coaching story..."
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {draft.bio.length} / 2000 characters
            </p>
          </CardContent>
        </Card>

        {/* Specialties */}
        <Card>
          <CardHeader>
            <CardTitle>Specialties</CardTitle>
            <CardDescription>
              Pick 1&ndash;3 categories. For Health &amp; Wellness, you can also select sub-niches.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {draft.specialties.map((entry, idx) => {
              const cat = COACH_CATEGORIES.find((c) => c.label === entry.category);
              return (
                <div
                  key={idx}
                  className="space-y-3 rounded-md border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Select
                      value={entry.category}
                      onValueChange={(v) =>
                        setDraft((d) => {
                          const next = [...d.specialties];
                          next[idx] = { category: v, subNiches: [] };
                          return { ...d, specialties: next };
                        })
                      }
                    >
                      <SelectTrigger className="max-w-xs">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {COACH_CATEGORIES.map((c) => (
                          <SelectItem key={c.slug} value={c.label}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove specialty"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          specialties: d.specialties.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {cat && cat.subNiches.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {cat.subNiches.map((sub) => {
                        const selected = entry.subNiches.includes(sub.label);
                        return (
                          <button
                            type="button"
                            key={sub.slug}
                            onClick={() =>
                              setDraft((d) => {
                                const next = [...d.specialties];
                                const curr = new Set(next[idx].subNiches);
                                if (curr.has(sub.label)) curr.delete(sub.label);
                                else curr.add(sub.label);
                                next[idx] = {
                                  ...next[idx],
                                  subNiches: Array.from(curr),
                                };
                                return { ...d, specialties: next };
                              })
                            }
                            className={`rounded-full border px-3 py-1 text-xs transition ${
                              selected
                                ? 'border-burgundy-dark bg-burgundy-dark text-white'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {draft.specialties.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    specialties: [...d.specialties, { category: 'Life', subNiches: [] }],
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add specialty
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Pricing + session types */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing &amp; session types</CardTitle>
            <CardDescription>Offer at least one session type.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={draft.currency}
                  onValueChange={(v) => setDraft((d) => ({ ...d, currency: v }))}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Hourly rate ({currencySymbol}, optional)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={
                    draft.hourlyRateCents === null ? '' : centsToDollars(draft.hourlyRateCents)
                  }
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      hourlyRateCents:
                        e.target.value === '' ? null : dollarsToCents(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-3">
              {draft.sessionTypes.map((st, idx) => (
                <div
                  key={idx}
                  className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={st.name}
                      onChange={(e) =>
                        setDraft((d) => {
                          const next = [...d.sessionTypes];
                          next[idx] = { ...next[idx], name: e.target.value };
                          return { ...d, sessionTypes: next };
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Duration</Label>
                    <Select
                      value={String(st.duration)}
                      onValueChange={(v) =>
                        setDraft((d) => {
                          const next = [...d.sessionTypes];
                          next[idx] = { ...next[idx], duration: Number(v) };
                          return { ...d, sessionTypes: next };
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SESSION_DURATIONS.map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {d} min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Price ({currencySymbol})</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={centsToDollars(st.priceCents)}
                      onChange={(e) =>
                        setDraft((d) => {
                          const next = [...d.sessionTypes];
                          next[idx] = {
                            ...next[idx],
                            priceCents: dollarsToCents(e.target.value),
                          };
                          return { ...d, sessionTypes: next };
                        })
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove session type"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          sessionTypes: d.sessionTypes.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {draft.sessionTypes.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      sessionTypes: [
                        ...d.sessionTypes,
                        { name: 'Session', duration: 60, priceCents: 10000 },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Add session type
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Credentials */}
        <Card>
          <CardHeader>
            <CardTitle>Credentials (optional)</CardTitle>
            <CardDescription>
              Add any certifications, degrees, licenses, or professional memberships. These are
              shown on your public profile once verified.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {draft.credentials.length === 0 && (
              <p className="text-sm text-muted-foreground">No credentials added yet.</p>
            )}
            {draft.credentials.map((c, idx) => (
              <div
                key={c.id ?? idx}
                className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-2"
              >
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={c.type}
                    onValueChange={(v) =>
                      setDraft((d) => {
                        const next = [...d.credentials];
                        next[idx] = { ...next[idx], type: v as CredentialType };
                        return { ...d, credentials: next };
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="certification">Certification</SelectItem>
                      <SelectItem value="degree">Degree</SelectItem>
                      <SelectItem value="license">License</SelectItem>
                      <SelectItem value="membership">Membership</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Issued year</Label>
                  <Input
                    type="number"
                    min={1900}
                    max={new Date().getFullYear()}
                    value={c.issuedYear ?? ''}
                    onChange={(e) =>
                      setDraft((d) => {
                        const next = [...d.credentials];
                        const v = e.target.value;
                        next[idx] = {
                          ...next[idx],
                          issuedYear: v === '' ? null : Number.parseInt(v, 10),
                        };
                        return { ...d, credentials: next };
                      })
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={c.title}
                    onChange={(e) =>
                      setDraft((d) => {
                        const next = [...d.credentials];
                        next[idx] = { ...next[idx], title: e.target.value };
                        return { ...d, credentials: next };
                      })
                    }
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Issuer</Label>
                  <Input
                    value={c.issuer}
                    onChange={(e) =>
                      setDraft((d) => {
                        const next = [...d.credentials];
                        next[idx] = { ...next[idx], issuer: e.target.value };
                        return { ...d, credentials: next };
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Credential ID (optional)</Label>
                  <Input
                    value={c.credentialId ?? ''}
                    onChange={(e) =>
                      setDraft((d) => {
                        const next = [...d.credentials];
                        next[idx] = {
                          ...next[idx],
                          credentialId: e.target.value || null,
                        };
                        return { ...d, credentials: next };
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Verification URL (optional)</Label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={c.verificationUrl ?? ''}
                    onChange={(e) =>
                      setDraft((d) => {
                        const next = [...d.credentials];
                        next[idx] = {
                          ...next[idx],
                          verificationUrl: e.target.value || null,
                        };
                        return { ...d, credentials: next };
                      })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        credentials: d.credentials.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Remove credential
                  </Button>
                </div>
              </div>
            ))}
            {draft.credentials.length < 20 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    credentials: [
                      ...d.credentials,
                      {
                        type: 'certification',
                        title: '',
                        issuer: '',
                        issuedYear: new Date().getFullYear(),
                      },
                    ],
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add credential
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Publish */}
        <Card>
          <CardHeader>
            <CardTitle>Review &amp; publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3">
              <Checkbox
                id="consent"
                checked={consented}
                onCheckedChange={(v) => setConsented(v === true)}
              />
              <Label htmlFor="consent" className="text-sm leading-relaxed">
                I have reviewed every field above. I understand this profile was drafted by AI from
                source material I provided, and that I am responsible for the accuracy of every
                claim (headline, bio, credentials, specialties, prices).
              </Label>
            </div>
            {publishError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{publishError}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => handlePublish(true)}
                disabled={isPublishing || !consented}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  'Publish profile'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePublish(false)}
                disabled={isPublishing}
              >
                Save as draft
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT COLUMN — live preview */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Live preview</CardTitle>
            <CardDescription>How your card looks in search</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 rounded-md border border-border p-4">
              <div className="flex items-center gap-3">
                {draft.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.profilePhotoUrl}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold uppercase text-muted-foreground">
                    {draft.displayName.slice(0, 2) || 'C'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{draft.displayName || 'Your name'}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {draft.headline || 'Your headline'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {draft.specialties.slice(0, 3).map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {s.category}
                  </Badge>
                ))}
              </div>

              {draft.bio && (
                <p className="line-clamp-4 text-sm text-muted-foreground">{draft.bio}</p>
              )}

              {draft.sessionTypes.length > 0 && (
                <div className="space-y-1 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Sessions</p>
                  {draft.sessionTypes.slice(0, 3).map((st, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="truncate">
                        {st.name} &middot; {st.duration}m
                      </span>
                      <span className="ml-2 font-medium">
                        {currencySymbol}
                        {centsToDollars(st.priceCents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {draft.credentials.length > 0 && (
                <div className="space-y-1 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Credentials</p>
                  {draft.credentials.slice(0, 3).map((c, i) => (
                    <p key={i} className="truncate text-xs text-muted-foreground">
                      {c.title} — {c.issuer}
                      {c.issuedYear ? ` (${c.issuedYear})` : ''}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
