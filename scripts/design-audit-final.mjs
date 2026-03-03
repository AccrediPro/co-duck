/**
 * Design audit — final authenticated pass.
 * Uses keyboard Enter to submit Clerk's sign-in form (force-click doesn't work, Enter does).
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

async function ensureDir(dir) { await mkdir(dir, { recursive: true }); }

async function goTo(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await page.waitForTimeout(1000);
  } catch {
    await page.waitForTimeout(500);
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
  await page.waitForTimeout(300);
  await shot(page, name, 'mobile');
  await page.setViewportSize(VIEWPORT);
  await page.waitForTimeout(200);
}

async function clerkLogin(page, email, password) {
  console.log(`  Logging in as ${email}...`);
  await goTo(page, `${BASE_URL}/sign-in`);
  await page.waitForTimeout(2500);

  try {
    await page.fill('#identifier-field', email);
    await page.fill('#password-field', password);
    await page.waitForTimeout(300);
    // Enter key works where click doesn't (button has offsetParent=null)
    await page.press('#password-field', 'Enter');
    await page.waitForTimeout(5000);
  } catch (e) {
    console.log(`  ⚠️  Login error: ${e.message.split('\n')[0]}`);
  }

  const url = page.url();
  const loggedIn = !url.includes('sign-in');
  console.log(`  → ${loggedIn ? '✅ Logged in' : '❌ Not logged in'} — ${url}`);
  return loggedIn;
}

async function run() {
  await ensureDir(SCREENSHOT_DIR);
  const browser = await chromium.launch({ headless: true });

  // ── COACH ──────────────────────────────────────────────────────────
  console.log('\n=== COACH AUTHENTICATED PAGES ===');
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    await clerkLogin(page, 'tettypottycoach@gmail.com', 'tettypottycoach');

    await auditPage(page, `${BASE_URL}/dashboard`, 'final-13-coach-dashboard');
    await auditPage(page, `${BASE_URL}/dashboard/sessions`, 'final-14-coach-sessions');
    await auditPage(page, `${BASE_URL}/dashboard/messages`, 'final-15-coach-messages');
    await auditPage(page, `${BASE_URL}/dashboard/action-items`, 'final-16-coach-action-items');
    await auditPage(page, `${BASE_URL}/dashboard/availability`, 'final-17-coach-availability');
    await auditPage(page, `${BASE_URL}/dashboard/profile`, 'final-18-coach-profile');
    await auditPage(page, `${BASE_URL}/dashboard/payments`, 'final-19-coach-payments');
    await auditPage(page, `${BASE_URL}/dashboard/settings`, 'final-20-coach-settings');
    await auditPage(page, `${BASE_URL}/dashboard/settings/security`, 'final-21-coach-settings-security');

    // Find a session detail
    await goTo(page, `${BASE_URL}/dashboard/sessions`);
    const links = await page.$$('a[href]');
    for (const link of links) {
      const href = await link.getAttribute('href').catch(() => null);
      if (href && /^\/dashboard\/sessions\/\d+/.test(href)) {
        console.log(`  Found session: ${href}`);
        await auditPage(page, `${BASE_URL}${href}`, 'final-22-session-detail-coach');
        break;
      }
    }

    await ctx.close();
  }

  // ── CLIENT ─────────────────────────────────────────────────────────
  console.log('\n=== CLIENT AUTHENTICATED PAGES ===');
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    await clerkLogin(page, 'tettypottyclient@gmail.com', 'tettypottyclient');

    await auditPage(page, `${BASE_URL}/dashboard`, 'final-24-client-dashboard');
    await auditPage(page, `${BASE_URL}/dashboard/my-sessions`, 'final-25-client-sessions');
    await auditPage(page, `${BASE_URL}/dashboard/messages`, 'final-26-client-messages');
    await auditPage(page, `${BASE_URL}/dashboard/action-items`, 'final-27-client-action-items');
    await auditPage(page, `${BASE_URL}/dashboard/profile`, 'final-28-client-profile');
    await auditPage(page, `${BASE_URL}/dashboard/settings`, 'final-29-client-settings');
    await auditPage(page, `${BASE_URL}/dashboard/settings/security`, 'final-30-client-settings-security');

    // Find a session detail
    await goTo(page, `${BASE_URL}/dashboard/my-sessions`);
    const links = await page.$$('a[href]');
    for (const link of links) {
      const href = await link.getAttribute('href').catch(() => null);
      if (href && /^\/dashboard\/sessions\/\d+/.test(href)) {
        await auditPage(page, `${BASE_URL}${href}`, 'final-31-session-detail-client');
        break;
      }
    }

    // Admin (client should be denied/redirected)
    await auditPage(page, `${BASE_URL}/admin`, 'final-32-admin-access-attempt');

    await ctx.close();
  }

  await browser.close();
  console.log('\n✅ Final authenticated screenshots done!');
  console.log(`📁 ${SCREENSHOT_DIR}`);
}

run().catch(console.error);
