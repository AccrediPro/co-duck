/**
 * @fileoverview URL Scraper — fetches a page and returns cleaned plain text
 *
 * Used by P0-11 (AI Coach Onboarding) to pull the coach's public web
 * presence (portfolio site, Instagram bio page, blog "About" page) and
 * feed it into the AI draft generator.
 *
 * Notes on LinkedIn: LinkedIn aggressively blocks unauthenticated scraping
 * (301 to login, HTTP 999, or empty body). When detected we throw a typed
 * error so the UI can instruct the user to paste their "About" section as
 * plain text instead.
 *
 * @module lib/ai/scrape
 */

import * as cheerio from 'cheerio';

/** Max number of bytes to download from the target URL. */
const MAX_FETCH_BYTES = 512 * 1024; // 512 KB — plenty for a bio page, bounds memory use.

/** Max number of characters of cleaned text returned to the model. */
const MAX_TEXT_CHARS = 12_000; // ~3k tokens.

/** Per-request fetch timeout. */
const FETCH_TIMEOUT_MS = 10_000;

const USER_AGENT = 'Mozilla/5.0 (compatible; CoDuckBot/1.0; +https://co-duck.com/bot)';

/**
 * Thrown when LinkedIn blocks the request. Callers should catch this
 * specifically and prompt the user to paste their LinkedIn text manually.
 */
export class LinkedInBlockedError extends Error {
  constructor(message = 'LinkedIn blocked the scrape request') {
    super(message);
    this.name = 'LinkedInBlockedError';
  }
}

/** Thrown for any other scrape failure (DNS, non-2xx, timeout, etc.). */
export class ScrapeFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScrapeFailedError';
  }
}

/**
 * Result of a successful scrape: the page title + cleaned, newline-joined
 * body text (scripts/styles/nav stripped).
 */
export interface ScrapeResult {
  url: string;
  title: string;
  text: string;
}

function isLinkedInUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith('linkedin.com');
  } catch {
    return false;
  }
}

/**
 * Fetches a URL and returns its cleaned text content.
 *
 * - Enforces HTTPS + size cap + timeout.
 * - Strips scripts, styles, SVG, and nav/footer elements before extracting text.
 * - Collapses whitespace; truncates to {@link MAX_TEXT_CHARS}.
 *
 * @throws {LinkedInBlockedError} When LinkedIn returns a login wall / 999.
 * @throws {ScrapeFailedError}    For any other fetch or parse failure.
 */
export async function scrapeUrl(rawUrl: string): Promise<ScrapeResult> {
  const url = normalizeUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if (isLinkedInUrl(url)) {
      throw new LinkedInBlockedError(
        `Could not fetch LinkedIn URL (${(err as Error).message}). Please paste your LinkedIn "About" text manually.`
      );
    }
    throw new ScrapeFailedError(`Failed to fetch ${url}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    if (
      isLinkedInUrl(url) &&
      (response.status === 999 || response.status === 401 || response.status === 403)
    ) {
      throw new LinkedInBlockedError(
        `LinkedIn blocked the request (status ${response.status}). Please paste your LinkedIn "About" text manually.`
      );
    }
    throw new ScrapeFailedError(`Fetch failed for ${url}: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new ScrapeFailedError(`Unsupported content type for ${url}: ${contentType || 'unknown'}`);
  }

  const html = await readCapped(response, MAX_FETCH_BYTES);

  if (isLinkedInUrl(url) && looksLikeLinkedInLoginWall(html)) {
    throw new LinkedInBlockedError(
      'LinkedIn returned a login wall. Please paste your LinkedIn "About" text manually.'
    );
  }

  const { title, text } = extractText(html);
  if (text.length < 40) {
    throw new ScrapeFailedError(`Page at ${url} did not contain enough text to draft a profile.`);
  }

  return { url, title, text: text.slice(0, MAX_TEXT_CHARS) };
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const u = new URL(withScheme);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new ScrapeFailedError(`Unsupported URL scheme: ${u.protocol}`);
  }
  return u.toString();
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return await response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      break;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

function looksLikeLinkedInLoginWall(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('authwall') ||
    lower.includes('sign in to linkedin') ||
    lower.includes('join linkedin') ||
    lower.includes('please enable javascript')
  );
}

/**
 * Strips boilerplate (scripts, styles, nav, footer, aside) and returns
 * the page title plus the visible text content.
 */
function extractText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);

  // Hard strip — these never carry meaningful bio content.
  $(
    'script, style, noscript, svg, iframe, nav, footer, aside, [aria-hidden="true"], header, form, input, button'
  ).remove();

  const title = ($('title').first().text() || '').trim();

  // Prefer the article / main tag, fall back to body.
  const root = $('article').length
    ? $('article').first()
    : $('main').length
      ? $('main').first()
      : $('body');

  // Replace line-break tags with actual newlines before extracting text.
  root.find('br').replaceWith('\n');
  root.find('p, li, h1, h2, h3, h4, h5, h6, div').each((_, el) => {
    $(el).append('\n');
  });

  const raw = root.text();
  const text = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  return { title, text };
}
