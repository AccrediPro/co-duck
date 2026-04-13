/**
 * Design audit — authenticated sessions only.
 * Clerk renders its sign-in UI in an iframe, so we target inputs inside it.
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = join(__dirname, '..', 'screenshots', 'design-audit');
const VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function goTo(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(1200);
  } catch {
    await page.waitForTimeout(800);
  }
}

async function shot(page, name, suffix = '') {
  const filename = suffix ? `${name}-${suffix}.png` : `${name}.png`;
  await page.screenshot({ path: join(SCREENSHOT_DIR, filename), fullPage: true }).catch(() => {});
  console.log(`  📸 ${filename}`);
}

async function auditPage(page, url, name) {
  console.log(`\n🔍 ${name} — ${url}`);
  await goTo(page, url);
  await shot(page, name);
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.waitForTimeout(400);
  await shot(page, name, 'mobile');
  await page.setViewportSize(VIEWPORT);
  await page.waitForTimeout(200);
}

async function clerkLogin(page, email, password) {
  await goTo(page, `${BASE_URL}/sign-in`);
  await page.waitForTimeout(2000);

  // Clerk may render in main frame or iframe — check both
  const frames = page.frames();
  console.log(`  Frames found: ${frames.length}`);

  let filled = false;
  for (const frame of frames) {
    try {
      const emailInput = await frame.$(
        'input[name="identifier"], input[autocomplete*="email"], input[type="email"]'
      );
      if (emailInput) {
        console.log(`  Found email input in frame: ${frame.url()}`);
        await emailInput.fill(email);
        await page.waitForTimeout(300);

        // Click continue/next button
        const continueBtn = await frame.$('button[type="submit"]');
        if (continueBtn) {
          await continueBtn.click();
          await page.waitForTimeout(2000);
        }

        // Now find password field
        const pwdInput = await frame.$('input[type="password"], input[name="password"]');
        if (pwdInput) {
          await pwdInput.fill(password);
          await page.waitForTimeout(300);
          const submitBtn = await frame.$('button[type="submit"]');
          if (submitBtn) {
            await submitBtn.click();
            await page.waitForTimeout(4000);
          }
        }
        filled = true;
        break;
      }
    } catch (e) {
      // try next frame
    }
  }

  if (!filled) {
    console.log('  ⚠️  Could not find Clerk email input in any frame');
  }

  const url = page.url();
  console.log(`  → After login: ${url}`);
  const loggedIn = !url.includes('sign-in');
  console.log(`  → Logged in: ${loggedIn}`);
  return loggedIn;
}

async function run() {
  await ensureDir(SCREENSHOT_DIR);
  const browser = await chromium.launch({ headless: true });

  // ── COACH SESSION ──────────────────────────────────────────────────
  console.log('\n=== COACH AUTHENTICATED PAGES ===');
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();

    const ok = await clerkLogin(page, 'tettypottycoach@gmail.com', 'tettypottycoach');
    if (!ok) {
      console.log('  ⚠️  Coach login failed — capturing redirect state anyway');
    }

    await auditPage(page, `${BASE_URL}/dashboard`, 'auth-13-coach-dashboard');
    await auditPage(page, `${BASE_URL}/dashboard/sessions`, 'auth-14-coach-sessions');
    await auditPage(page, `${BASE_URL}/dashboard/messages`, 'auth-15-coach-messages');
    await auditPage(page, `${BASE_URL}/dashboard/action-items`, 'auth-16-coach-action-items');
    await auditPage(page, `${BASE_URL}/dashboard/availability`, 'auth-17-coach-availability');
    await auditPage(page, `${BASE_URL}/dashboard/profile`, 'auth-18-coach-profile');
    await auditPage(page, `${BASE_URL}/dashboard/payments`, 'auth-19-coach-payments');
    await auditPage(page, `${BASE_URL}/dashboard/settings`, 'auth-20-coach-settings');

    // Try to find a session detail
    await goTo(page, `${BASE_URL}/dashboard/sessions`);
    const links = await page.$$('a[href]');
    for (const link of links) {
      const href = await link.getAttribute('href').catch(() => null);
      if (
        href &&
        href.startsWith('/dashboard/sessions/') &&
        href.length > '/dashboard/sessions/'.length
      ) {
        console.log(`  Found session link: ${href}`);
        await auditPage(page, `${BASE_URL}${href}`, 'auth-22-session-detail-coach');
        break;
      }
    }

    await ctx.close();
  }

  // ── CLIENT SESSION ─────────────────────────────────────────────────
  console.log('\n=== CLIENT AUTHENTICATED PAGES ===');
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();

    const ok = await clerkLogin(page, 'tettypottyclient@gmail.com', 'tettypottyclient');
    if (!ok) {
      console.log('  ⚠️  Client login failed — capturing redirect state anyway');
    }

    await auditPage(page, `${BASE_URL}/dashboard`, 'auth-24-client-dashboard');
    await auditPage(page, `${BASE_URL}/dashboard/my-sessions`, 'auth-25-client-sessions');
    await auditPage(page, `${BASE_URL}/dashboard/messages`, 'auth-26-client-messages');
    await auditPage(page, `${BASE_URL}/dashboard/action-items`, 'auth-27-client-action-items');
    await auditPage(page, `${BASE_URL}/dashboard/profile`, 'auth-28-client-profile');
    await auditPage(page, `${BASE_URL}/dashboard/settings`, 'auth-29-client-settings');

    // Find a session detail
    await goTo(page, `${BASE_URL}/dashboard/my-sessions`);
    const links = await page.$$('a[href]');
    for (const link of links) {
      const href = await link.getAttribute('href').catch(() => null);
      if (
        href &&
        href.startsWith('/dashboard/sessions/') &&
        href.length > '/dashboard/sessions/'.length
      ) {
        await auditPage(page, `${BASE_URL}${href}`, 'auth-31-session-detail-client');
        break;
      }
    }

    // Admin (client will be redirected, that's fine — shows the guard)
    await auditPage(page, `${BASE_URL}/admin`, 'auth-32-admin-attempt');

    await ctx.close();
  }

  await browser.close();
  console.log('\n✅ Authenticated screenshots done!');
}

run().catch(console.error);
