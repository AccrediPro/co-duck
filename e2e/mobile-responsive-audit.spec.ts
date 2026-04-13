/**
 * M6: Mobile Responsiveness Audit — Authenticated Pages
 * Tests all authenticated pages at 375px (mobile) and 1280px (desktop)
 */

import { test, expect, Page } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 375, height: 812 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

async function checkHorizontalOverflow(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
}

async function checkSmallTouchTargets(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const issues: string[] = [];
    const els = document.querySelectorAll(
      'button, a[href], input, select, textarea, [role="button"]'
    );
    els.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.height < 44 || rect.width < 44)) {
        const text =
          (el as HTMLElement).innerText?.trim().slice(0, 25) ||
          (el as HTMLElement).getAttribute('aria-label')?.slice(0, 25) ||
          el.tagName;
        issues.push(
          `${el.tagName}["${text}"]: ${Math.round(rect.width)}x${Math.round(rect.height)}px`
        );
      }
    });
    return issues.slice(0, 8);
  });
}

async function checkTextOverflow(page: Page): Promise<number> {
  return await page.evaluate(() => {
    let count = 0;
    const els = document.querySelectorAll('p, h1, h2, h3, h4, h5, span, label, td, th');
    els.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.scrollWidth > htmlEl.clientWidth + 2 && htmlEl.clientWidth > 0) count++;
    });
    return count;
  });
}

async function getVisibleText(page: Page, selector: string): Promise<string> {
  try {
    return await page.locator(selector).first().innerText({ timeout: 3000 });
  } catch {
    return '';
  }
}

interface IssueEntry {
  severity: 'critical' | 'major' | 'minor';
  description: string;
}

async function auditPage(
  page: Page,
  url: string,
  viewport: { width: number; height: number },
  label: string,
  role: string
): Promise<{ pass: boolean; issues: IssueEntry[]; notes: string[] }> {
  const issues: IssueEntry[] = [];
  const notes: string[] = [];

  try {
    await page.setViewportSize(viewport);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const status = response?.status() ?? 0;
    if (status >= 400) {
      issues.push({
        severity: 'critical',
        description: `HTTP ${status} — page not found or inaccessible`,
      });
      return { pass: false, issues, notes };
    }

    // Wait for hydration
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    // Redirect check — did we get kicked to sign-in?
    const finalUrl = page.url();
    if (finalUrl.includes('sign-in') || finalUrl.includes('sign-up')) {
      issues.push({
        severity: 'critical',
        description: `Redirected to auth page — session not preserved (landed: ${finalUrl})`,
      });
      return { pass: false, issues, notes };
    }

    notes.push(`Final URL: ${finalUrl}`);

    // --- Horizontal overflow ---
    const hasOverflow = await checkHorizontalOverflow(page);
    if (hasOverflow) {
      issues.push({
        severity: 'critical',
        description: 'Horizontal overflow — page wider than viewport (horizontal scrollbar)',
      });
    }

    // --- Touch targets (mobile only) ---
    if (viewport.width <= 375) {
      const smallTargets = await checkSmallTouchTargets(page);
      if (smallTargets.length > 3) {
        issues.push({
          severity: 'major',
          description: `${smallTargets.length} small touch targets (<44px): ${smallTargets.slice(0, 4).join(' | ')}`,
        });
      } else if (smallTargets.length > 0) {
        issues.push({
          severity: 'minor',
          description: `${smallTargets.length} small touch targets: ${smallTargets.join(' | ')}`,
        });
      }
    }

    // --- Text overflow ---
    const overflowCount = await checkTextOverflow(page);
    if (overflowCount > 5) {
      issues.push({
        severity: 'major',
        description: `${overflowCount} text elements have overflow (content clipped)`,
      });
    } else if (overflowCount > 0) {
      issues.push({
        severity: 'minor',
        description: `${overflowCount} text element(s) with possible overflow`,
      });
    }

    // --- Mobile nav check ---
    if (viewport.width <= 375) {
      // Check for hamburger or sidebar toggle
      const hamburgerVisible = await page
        .locator(
          '[aria-label*="menu" i], [aria-label*="sidebar" i], [aria-label*="toggle" i], ' +
            'button[class*="hamburger"], button[class*="mobile"], [data-testid*="menu"]'
        )
        .first()
        .isVisible()
        .catch(() => false);

      const sidebarVisible = await page
        .locator('aside, nav, [role="navigation"]')
        .first()
        .isVisible()
        .catch(() => false);

      if (!hamburgerVisible && !sidebarVisible) {
        issues.push({
          severity: 'major',
          description: 'No navigation visible on mobile (no hamburger, no sidebar, no nav element)',
        });
      } else {
        notes.push(
          hamburgerVisible ? 'Mobile hamburger/toggle visible ✓' : 'Sidebar/nav visible ✓'
        );
      }
    }

    // --- Desktop nav check ---
    if (viewport.width >= 1280) {
      const navVisible = await page
        .locator('nav, aside, [role="navigation"]')
        .first()
        .isVisible()
        .catch(() => false);
      if (!navVisible) {
        issues.push({ severity: 'major', description: 'No navigation element visible on desktop' });
      }
    }

    // --- Page content sanity check ---
    const bodyText = await page
      .locator('body')
      .innerText({ timeout: 3000 })
      .catch(() => '');
    if (bodyText.length < 50) {
      issues.push({
        severity: 'major',
        description: 'Page appears empty — very little text content rendered',
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    issues.push({ severity: 'critical', description: `Exception: ${msg.slice(0, 120)}` });
  }

  const pass = !issues.some((i) => i.severity === 'critical' || i.severity === 'major');
  return { pass, issues, notes };
}

// ============================================================
// COACH PAGES — uses coach storageState from playwright.config.ts
// ============================================================

const COACH_PAGES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Sessions', path: '/dashboard/sessions' },
  { name: 'Messages', path: '/dashboard/messages' },
  { name: 'Clients', path: '/dashboard/clients' },
  { name: 'Availability', path: '/dashboard/availability' },
  { name: 'Payments', path: '/dashboard/payments' },
  { name: 'Action Items', path: '/dashboard/action-items' },
  { name: 'Settings', path: '/dashboard/settings' },
  { name: 'Settings Security', path: '/dashboard/settings/security' },
  { name: 'Profile', path: '/dashboard/profile' },
];

test.describe('Coach — Mobile 375px', () => {
  for (const { name, path } of COACH_PAGES) {
    test(`${name} @ 375px`, async ({ page }) => {
      const result = await auditPage(page, path, MOBILE_VIEWPORT, '375px', 'coach');
      const status = result.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`[COACH MOBILE] ${name} (${path}): ${status}`);
      result.issues.forEach((i) => console.log(`  [${i.severity.toUpperCase()}] ${i.description}`));
      result.notes.forEach((n) => console.log(`  NOTE: ${n}`));

      // Don't hard-fail on HTTP 404 — just report (page may not exist for this role)
      const nonHttpCritical = result.issues.filter(
        (i) => i.severity === 'critical' && !i.description.includes('HTTP')
      );
      expect(nonHttpCritical, `Critical issues on ${name} (coach, mobile)`).toHaveLength(0);
    });
  }
});

test.describe('Coach — Desktop 1280px', () => {
  for (const { name, path } of COACH_PAGES) {
    test(`${name} @ 1280px`, async ({ page }) => {
      const result = await auditPage(page, path, DESKTOP_VIEWPORT, '1280px', 'coach');
      const status = result.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`[COACH DESKTOP] ${name} (${path}): ${status}`);
      result.issues.forEach((i) => console.log(`  [${i.severity.toUpperCase()}] ${i.description}`));
      result.notes.forEach((n) => console.log(`  NOTE: ${n}`));

      const nonHttpCritical = result.issues.filter(
        (i) => i.severity === 'critical' && !i.description.includes('HTTP')
      );
      expect(nonHttpCritical, `Critical issues on ${name} (coach, desktop)`).toHaveLength(0);
    });
  }
});

// ============================================================
// CLIENT PAGES — uses client storageState from playwright.config.ts
// ============================================================

const CLIENT_PAGES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'My Sessions', path: '/dashboard/my-sessions' },
  { name: 'Messages', path: '/dashboard/messages' },
  { name: 'My Coaches', path: '/dashboard/my-coaches' },
  { name: 'Action Items', path: '/dashboard/action-items' },
  { name: 'Settings', path: '/dashboard/settings' },
  { name: 'Profile', path: '/dashboard/profile' },
];

test.describe('Client — Mobile 375px', () => {
  for (const { name, path } of CLIENT_PAGES) {
    test(`${name} @ 375px`, async ({ page }) => {
      const result = await auditPage(page, path, MOBILE_VIEWPORT, '375px', 'client');
      const status = result.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`[CLIENT MOBILE] ${name} (${path}): ${status}`);
      result.issues.forEach((i) => console.log(`  [${i.severity.toUpperCase()}] ${i.description}`));
      result.notes.forEach((n) => console.log(`  NOTE: ${n}`));

      const nonHttpCritical = result.issues.filter(
        (i) => i.severity === 'critical' && !i.description.includes('HTTP')
      );
      expect(nonHttpCritical, `Critical issues on ${name} (client, mobile)`).toHaveLength(0);
    });
  }
});

test.describe('Client — Desktop 1280px', () => {
  for (const { name, path } of CLIENT_PAGES) {
    test(`${name} @ 1280px`, async ({ page }) => {
      const result = await auditPage(page, path, DESKTOP_VIEWPORT, '1280px', 'client');
      const status = result.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`[CLIENT DESKTOP] ${name} (${path}): ${status}`);
      result.issues.forEach((i) => console.log(`  [${i.severity.toUpperCase()}] ${i.description}`));
      result.notes.forEach((n) => console.log(`  NOTE: ${n}`));

      const nonHttpCritical = result.issues.filter(
        (i) => i.severity === 'critical' && !i.description.includes('HTTP')
      );
      expect(nonHttpCritical, `Critical issues on ${name} (client, desktop)`).toHaveLength(0);
    });
  }
});
