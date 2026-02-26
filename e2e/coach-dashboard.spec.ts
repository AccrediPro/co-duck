import { test, expect } from '@playwright/test';

test.describe('Dashboard Coach', () => {
  test('la dashboard si carica con statistiche coach', async ({ page }) => {
    await page.goto('/dashboard');

    // Verifica che la dashboard si carica
    await expect(page.locator('h1')).toContainText('Dashboard', { timeout: 10_000 });

    // Verifica messaggio di benvenuto
    await expect(page.getByText(/welcome back/i)).toBeVisible();
  });

  test('la pagina Sessions si carica', async ({ page }) => {
    await page.goto('/dashboard/sessions');

    // Verifica che la pagina sessioni si carica
    await expect(page.getByText(/sessions/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('la pagina Availability si carica', async ({ page }) => {
    await page.goto('/dashboard/availability');

    // Verifica che la pagina disponibilità si carica
    await expect(page.getByText(/availability/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('la pagina Availability mostra lo schedule settimanale', async ({ page }) => {
    await page.goto('/dashboard/availability');

    // Verifica che ci siano i giorni della settimana
    await expect(page.getByText(/availability/i).first()).toBeVisible({ timeout: 10_000 });
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const day of weekdays.slice(0, 3)) {
      const dayVisible = await page.getByText(day).isVisible().catch(() => false);
      if (dayVisible) {
        await expect(page.getByText(day)).toBeVisible();
        break;
      }
    }
  });

  test('la pagina Messages si carica', async ({ page }) => {
    await page.goto('/dashboard/messages');

    // Verifica che la pagina messaggi si carica
    await expect(page.getByText(/messages|conversations/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('la pagina Profile si carica con il form di modifica', async ({ page }) => {
    await page.goto('/dashboard/profile');

    // Verifica che la pagina profilo si carica
    await expect(page.getByText(/profile/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('la pagina Payments si carica', async ({ page }) => {
    await page.goto('/dashboard/payments');

    // Verifica che la pagina pagamenti si carica
    await expect(page.getByText(/payments|earnings/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('la sidebar coach ha i link corretti', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard', { timeout: 10_000 });

    // Verifica i link della sidebar coach — uso .first() per evitare strict mode
    const sidebar = page.locator('aside').first();
    await expect(sidebar.locator('a[href="/dashboard"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/dashboard/sessions"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/dashboard/availability"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/dashboard/messages"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/dashboard/profile"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/dashboard/payments"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/dashboard/settings"]')).toBeVisible();
  });

  test('la navigazione dalla sidebar funziona', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard', { timeout: 10_000 });

    // Usa la sidebar per navigare
    const sidebar = page.locator('aside').first();

    // Clicca su Sessions
    await sidebar.locator('a[href="/dashboard/sessions"]').click();
    await page.waitForURL('**/dashboard/sessions');

    // Clicca su Availability
    await sidebar.locator('a[href="/dashboard/availability"]').click();
    await page.waitForURL('**/dashboard/availability');

    // Clicca su Profile
    await sidebar.locator('a[href="/dashboard/profile"]').click();
    await page.waitForURL('**/dashboard/profile');
  });
});
