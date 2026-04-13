import type { LinkPreviewData } from '@/db/schema';

const URL_REGEX =
  /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*/gi;

const FETCH_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 200;
const MAX_HTML_SIZE = 512 * 1024; // 512KB — don't parse huge pages

interface CacheEntry {
  data: LinkPreviewData | null;
  expiresAt: number;
}

const previewCache = new Map<string, CacheEntry>();

function isInternalUrl(url: string): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return false;
  try {
    const parsed = new URL(url);
    const appParsed = new URL(appUrl);
    return parsed.hostname === appParsed.hostname;
  } catch {
    return false;
  }
}

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  return Array.from(new Set(matches)).filter((url) => !isInternalUrl(url));
}

function extractMetaContent(html: string, property: string): string | undefined {
  // Match both property="..." and name="..." attributes
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : undefined;
}

function extractMetaDescription(html: string): string | undefined {
  return extractMetaContent(html, 'description');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function resolveUrl(base: string, relative: string | undefined): string | undefined {
  if (!relative) return undefined;
  if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
  try {
    return new URL(relative, base).href;
  } catch {
    return undefined;
  }
}

function evictExpired(): void {
  const now = Date.now();
  previewCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) previewCache.delete(key);
  });
  // Hard cap: evict oldest entries if cache is too large
  if (previewCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(previewCache.entries()).sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt
    );
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => previewCache.delete(key));
  }
}

export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  // Check cache
  const cached = previewCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CoachingPlatformBot/1.0; +https://example.com/bot)',
        Accept: 'text/html',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      cacheResult(url, null);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      cacheResult(url, null);
      return null;
    }

    // Read a limited amount of HTML (OG tags are in <head>)
    const reader = response.body?.getReader();
    if (!reader) {
      cacheResult(url, null);
      return null;
    }

    let html = '';
    const decoder = new TextDecoder();
    let bytesRead = 0;

    while (bytesRead < MAX_HTML_SIZE) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      html += decoder.decode(value, { stream: true });
      // Stop early if we've passed </head> — OG tags live in <head>
      if (html.includes('</head>')) break;
    }

    reader.cancel().catch(() => {});

    const ogTitle = extractMetaContent(html, 'og:title');
    const ogDescription = extractMetaContent(html, 'og:description');
    const ogImage = extractMetaContent(html, 'og:image');
    const ogSiteName = extractMetaContent(html, 'og:site_name');

    const title = ogTitle || extractTitle(html);
    const description = ogDescription || extractMetaDescription(html);

    if (!title && !description && !ogImage) {
      cacheResult(url, null);
      return null;
    }

    const preview: LinkPreviewData = {
      url,
      title: title?.slice(0, 300),
      description: description?.slice(0, 500),
      image: resolveUrl(url, ogImage),
      siteName: ogSiteName?.slice(0, 100),
    };

    cacheResult(url, preview);
    return preview;
  } catch {
    cacheResult(url, null);
    return null;
  }
}

function cacheResult(url: string, data: LinkPreviewData | null): void {
  evictExpired();
  previewCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}
