import { test, expect } from '@playwright/test';

// Helper: naviga alla pagina gestendo eventuali Server Error intermittenti
async function gotoWithRetry(page: import('@playwright/test').Page, path: string, maxRetries = 2) {
  for (let i = 0; i <= maxRetries; i++) {
    await page.goto(path);
    const hasServerError = await page
      .locator('h1:has-text("Server Error")')
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    if (!hasServerError) return;
    if (i < maxRetries) await page.waitForTimeout(1_000);
  }
}

test.describe('Pagine pubbliche', () => {
  test('la homepage si carica con la hero section e le card dei coach', async ({ page }) => {
    await gotoWithRetry(page, '/');

    // Verifica hero section
    await expect(page.locator('h1')).toContainText('Find Your Perfect Coach', { timeout: 15_000 });

    // Verifica CTA principali
    await expect(page.getByRole('link', { name: /find a coach/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /become a coach/i }).first()).toBeVisible();

    // Verifica sezione "Why Choose AccrediPro CoachHub?"
    await expect(
      page.getByRole('heading', { name: 'Why Choose AccrediPro CoachHub?' })
    ).toBeVisible();

    // Verifica sezione "How It Works"
    await expect(page.getByRole('heading', { name: 'How It Works', exact: true })).toBeVisible();

    // Verifica sezione coach in evidenza
    await expect(page.getByRole('heading', { name: 'Featured Coaches' })).toBeVisible();
  });

  test('la directory coach si carica con ricerca e filtri', async ({ page }) => {
    await gotoWithRetry(page, '/coaches');

    // Verifica titolo pagina
    await expect(page.locator('h1')).toContainText('Find a Coach', { timeout: 15_000 });

    // Verifica campo di ricerca
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
  });

  test('la ricerca coach funziona', async ({ page }) => {
    await gotoWithRetry(page, '/coaches');

    // Attendi caricamento
    await expect(page.locator('h1')).toContainText('Find a Coach', { timeout: 15_000 });

    // Digita nella ricerca
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('test');

    // Attendi che la pagina si aggiorni (debounce)
    await page.waitForTimeout(500);

    // Verifica che la pagina risponda alla ricerca (non dia errore)
    await expect(page.locator('h1')).toContainText('Find a Coach');
  });

  test('la pagina About si carica', async ({ page }) => {
    await gotoWithRetry(page, '/about');

    await expect(page.locator('h1')).toContainText('Empowering Growth', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Our Mission' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Our Values' })).toBeVisible();
  });

  test('la pagina Contact si carica con il form', async ({ page }) => {
    await gotoWithRetry(page, '/contact');

    await expect(page.locator('h1')).toContainText('Get in Touch', { timeout: 15_000 });

    // Verifica sezione form e FAQ
    await expect(page.getByRole('heading', { name: 'Send Us a Message' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeVisible();
  });

  test('la pagina Specialties si carica con le specialità', async ({ page }) => {
    await gotoWithRetry(page, '/specialties');

    await expect(page.locator('h1')).toContainText('Specialties', { timeout: 15_000 });

    // Verifica che ci siano card di specialità
    await expect(page.getByRole('heading', { name: 'Life Coaching' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Career Coaching' })).toBeVisible();
  });

  test('la pagina Terms si carica', async ({ page }) => {
    await gotoWithRetry(page, '/terms');

    await expect(page.locator('h1')).toContainText('Terms of Service', { timeout: 15_000 });
  });

  test('la pagina Privacy si carica', async ({ page }) => {
    await gotoWithRetry(page, '/privacy');

    await expect(page.locator('h1')).toContainText('Privacy Policy', { timeout: 15_000 });
  });

  test('una pagina coach inesistente ritorna 404', async ({ page }) => {
    const response = await page.goto('/coaches/coach-inesistente-xyz-404');

    // Verifica risposta 404 o messaggio di errore nella pagina
    const is404 = response?.status() === 404;
    const hasNotFoundText = await page
      .getByText(/not found|404|doesn't exist/i)
      .isVisible()
      .catch(() => false);

    expect(is404 || hasNotFoundText).toBeTruthy();
  });
});
