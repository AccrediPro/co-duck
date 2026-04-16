'use client';

/**
 * Dashboard UI that lets a coach grab their personalized embed snippet
 * for Squarespace / WordPress / Linktree. Also exposes theme controls + a
 * live preview iframe so they can see what visitors will see.
 */

import { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SessionType } from '@/db/schema';

interface EmbedSnippetProps {
  slug: string;
  appUrl: string;
  sessionTypes: SessionType[];
}

const ALL_SESSIONS = '__all__';

export function EmbedSnippet({ slug, appUrl, sessionTypes }: EmbedSnippetProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sessionId, setSessionId] = useState<string>(ALL_SESSIONS);
  const [primary, setPrimary] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(() => {
    const attrs: string[] = [
      'data-coachhub-widget="booking"',
      `data-coach="${slug}"`,
      `data-theme="${theme}"`,
    ];
    if (sessionId && sessionId !== ALL_SESSIONS) attrs.push(`data-session="${sessionId}"`);
    if (isValidHex(primary)) attrs.push(`data-primary="${primary}"`);

    return [
      `<!-- CoachHub booking widget for ${slug} -->`,
      `<div ${attrs.join(' ')}\n     style="max-width:640px;margin:0 auto;"></div>`,
      `<script async src="${appUrl}/widget.js"></script>`,
    ].join('\n');
  }, [slug, appUrl, theme, sessionId, primary]);

  const previewUrl = useMemo(() => {
    const params = new URLSearchParams({ coach: slug, theme });
    if (sessionId && sessionId !== ALL_SESSIONS) params.set('session', sessionId);
    if (isValidHex(primary)) params.set('primary', primary);
    return `${appUrl}/embed/booking?${params.toString()}`;
  }, [slug, appUrl, theme, sessionId, primary]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in some browsers; fall back to selection.
      const el = document.querySelector<HTMLTextAreaElement>('#embed-snippet-textarea');
      if (el) {
        el.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configure your widget</CardTitle>
          <CardDescription>
            Pick the defaults visitors will see. You can still override them per page via
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">data-*</code>
            attributes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="embed-theme">Theme</Label>
            <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark')}>
              <SelectTrigger id="embed-theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="embed-session">Preselect session</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger id="embed-session">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SESSIONS}>Let visitor choose</SelectItem>
                {sessionTypes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.duration}m
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="embed-primary">Accent color (hex)</Label>
            <Input
              id="embed-primary"
              placeholder="#6B1F2A"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              maxLength={7}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Copy & paste snippet</CardTitle>
            <CardDescription>
              Paste this into a Code / Embed / HTML block on Squarespace, WordPress, Linktree,
              Carrd, or any site that allows custom HTML.
            </CardDescription>
          </div>
          <Button size="sm" onClick={handleCopy} variant={copied ? 'secondary' : 'default'}>
            {copied ? (
              <>
                <Check className="mr-1 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <textarea
            id="embed-snippet-textarea"
            readOnly
            value={snippet}
            className="min-h-[140px] w-full resize-y rounded-md border border-border bg-muted/30 p-3 font-mono text-xs leading-5 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            onFocus={(e) => e.currentTarget.select()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>
              This is exactly what visitors will see. Scroll inside the preview to try it.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" asChild>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-4 w-4" />
              Open in new tab
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-border">
            <iframe
              key={previewUrl}
              src={previewUrl}
              title="Booking widget preview"
              className="block h-[720px] w-full bg-background"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Installation tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Squarespace:</strong> Add a<em> Code Block </em>{' '}
            (Insert → More → Code), paste the snippet, and disable &quot;Display Source&quot;.
          </p>
          <p>
            <strong className="text-foreground">WordPress:</strong> Use the
            <em> Custom HTML </em> block (Gutenberg) or a <em>Shortcode</em> block with a plugin
            that allows raw HTML.
          </p>
          <p>
            <strong className="text-foreground">Linktree:</strong> Enable a
            <em> Custom Appearance / Embed link </em> on Pro plans. Free plans can link out to your
            CoachHub profile instead.
          </p>
          <p>
            <strong className="text-foreground">Multiple widgets on one page:</strong> Just paste
            the <code className="mx-0.5 rounded bg-muted px-1">&lt;div&gt;</code> as many times as
            you like — only include the{' '}
            <code className="mx-0.5 rounded bg-muted px-1">&lt;script&gt;</code>
            tag once.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function isValidHex(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}
