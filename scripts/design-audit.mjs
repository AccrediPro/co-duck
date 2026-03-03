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
    await page.waitForTimeout(1500);
  } catch (e) {
    console.log(`  ⚠️  Timeout navigating to ${url}: ${e.message.split('\n')[0]}`);
    await page.waitForTimeout(500);
  }
}

async function screenshot(page, name, suffix = '') {
  const filename = suffix ? `${name}-${suffix}.png` : `${name}.png`;
  const path = join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path, fullPage: true }).catch(e => console.log(`  ⚠️  Screenshot failed: ${e.message}`));
  console.log(`  📸 ${filename}`);
}

async function auditPage(page, url, name) {
  console.log(`\n🔍 ${name} — ${url}`);
  await goTo(page, url);
  await screenshot(page, name);
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.waitForTimeout(400);
  await screenshot(page, name, 'mobile');
  await page.setViewportSize(VIEWPORT);
  await page.waitForTimeout(200);
}

async function loginAs(page, email, password, role) {
  console.log(`\n=== LOGGING IN AS ${role.toUpperCase()} ===`);
  await goTo(page, `${BASE_URL}/sign-in`);
  await page.waitForTimeout(1000);

  // Clerk renders an iframe or direct form
  try {
    // Try direct inputs first
    const emailInput = await page.$('input[name="identifier"], input[type="email"], input[autocomplete="username email"]');
    if (emailInput) {
      await emailInput.click();
      await emailInput.fill(email);
      await page.waitForTimeout(300);

      const continueBtn = await page.$('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")');
      if (continueBtn) {
        await continueBtn.click();
        await page.waitForTimeout(1500);
      }

      const passwordInput = await page.$('input[name="password"], input[type="password"]');
      if (passwordInput) {
        await passwordInput.click();
        await passwordInput.fill(password);
        await page.waitForTimeout(300);

        const signInBtn = await page.$('button[type="submit"]');
        if (signInBtn) {
          await signInBtn.click();
          await page.waitForTimeout(3000);
        }
      }
    } else {
      console.log('  ⚠️  Could not find email input');
    }
  } catch (e) {
    console.log(`  ⚠️  Login failed: ${e.message}`);
  }

  const url = page.url();
  console.log(`  → After login URL: ${url}`);
  await screenshot(page, `login-${role}`);
}

async function run() {
  await ensureDir(SCREENSHOT_DIR);
  const browser = await chromium.launch({ headless: true });

  // ==========================================
  // SESSION 1: PUBLIC PAGES
  // ==========================================
  {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    console.log('\n=== PUBLIC PAGES ===');
    await auditPage(page, `${BASE_URL}/`, '01-home');
    await auditPage(page, `${BASE_URL}/coaches`, '02-coaches-listing');
    await auditPage(page, `${BASE_URL}/about`, '03-about');
    await auditPage(page, `${BASE_URL}/specialties`, '04-specialties');
    await auditPage(page, `${BASE_URL}/contact`, '05-contact');
    await auditPage(page, `${BASE_URL}/terms`, '06-terms');
    await auditPage(page, `${BASE_URL}/privacy`, '07-privacy');

    // Discover coach profile URL
    await goTo(page, `${BASE_URL}/coaches`);
    const coachLink = await page.$('a[href^="/coaches/"]');
    let coachSlug = null;
    if (coachLink) {
      const href = await coachLink.getAttribute('href');
      coachSlug = href?.split('/coaches/')[1]?.split('/')[0];
      console.log(`  Found coach slug: ${coachSlug}`);
    }

    if (coachSlug) {
      await auditPage(page, `${BASE_URL}/coaches/${coachSlug}`, '08-coach-profile');
      await auditPage(page, `${BASE_URL}/coaches/${coachSlug}/book`, '09-book-session');
    }

    await auditPage(page, `${BASE_URL}/sign-in`, '10-sign-in');
    await auditPage(page, `${BASE_URL}/sign-up`, '11-sign-up');

    await context.close();
  }

  // ==========================================
  // SESSION 2: COACH DASHBOARD
  // ==========================================
  {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    await loginAs(page, 'tettypottycoach@gmail.com', 'tettypottycoach', 'coach');

    const coachPages = [
      ['dashboard', '13-coach-dashboard'],
      ['dashboard/sessions', '14-coach-sessions'],
      ['dashboard/messages', '15-coach-messages'],
      ['dashboard/action-items', '16-coach-action-items'],
      ['dashboard/availability', '17-coach-availability'],
      ['dashboard/profile', '18-coach-profile'],
      ['dashboard/payments', '19-coach-payments'],
      ['dashboard/settings', '20-coach-settings'],
      ['dashboard/settings/security', '21-coach-settings-security'],
    ];

    console.log('\n=== COACH DASHBOARD PAGES ===');
    for (const [path, name] of coachPages) {
      await auditPage(page, `${BASE_URL}/${path}`, name);
    }

    // Try finding a specific session
    await goTo(page, `${BASE_URL}/dashboard/sessions`);
    const sessionLink = await page.$('a[href*="/dashboard/sessions/"][href!="/dashboard/sessions"]');
    if (sessionLink) {
      const href = await sessionLink.getAttribute('href');
      if (href && href.length > '/dashboard/sessions'.length) {
        await auditPage(page, `${BASE_URL}${href}`, '22-session-detail-coach');
      }
    }

    // Onboarding pages (for coach)
    await auditPage(page, `${BASE_URL}/onboarding/coach`, '23-onboarding-step1');

    await context.close();
  }

  // ==========================================
  // SESSION 3: CLIENT DASHBOARD
  // ==========================================
  {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    await loginAs(page, 'tettypottyclient@gmail.com', 'tettypottyclient', 'client');

    const clientPages = [
      ['dashboard', '24-client-dashboard'],
      ['dashboard/my-sessions', '25-client-sessions'],
      ['dashboard/messages', '26-client-messages'],
      ['dashboard/action-items', '27-client-action-items'],
      ['dashboard/profile', '28-client-profile'],
      ['dashboard/settings', '29-client-settings'],
      ['dashboard/settings/security', '30-client-settings-security'],
    ];

    console.log('\n=== CLIENT DASHBOARD PAGES ===');
    for (const [path, name] of clientPages) {
      await auditPage(page, `${BASE_URL}/${path}`, name);
    }

    // Try finding a session
    await goTo(page, `${BASE_URL}/dashboard/my-sessions`);
    const sessionLink = await page.$('a[href*="/dashboard/sessions/"]');
    if (sessionLink) {
      const href = await sessionLink.getAttribute('href');
      if (href) {
        await auditPage(page, `${BASE_URL}${href}`, '31-session-detail-client');
      }
    }

    await context.close();
  }

  // ==========================================
  // SESSION 4: ADMIN (may redirect)
  // ==========================================
  {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    // Try admin without login (will likely 403/redirect)
    console.log('\n=== ADMIN PAGES (unauthenticated) ===');
    await auditPage(page, `${BASE_URL}/admin`, '32-admin-dashboard');
    await context.close();
  }

  await browser.close();
  console.log('\n✅ All screenshots captured!');
  console.log(`📁 Saved to: ${SCREENSHOT_DIR}`);
}

run().catch(console.error);
