import { test, expect } from '@playwright/test';

test.describe('Dashboard Client', () => {
  test('la dashboard si carica con messaggio di benvenuto', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Verifica che la dashboard si carica
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Verifica messaggio di benvenuto
    await expect(page.getByText(/welcome back/i)).toBeVisible();
  });

  test('la pagina My Sessions si carica', async ({ page }) => {
    await page.goto('/dashboard/my-sessions');
    await page.waitForLoadState('domcontentloaded');

    // Verifica che la pagina si carica (titolo o contenuto sessioni)
    await expect(page.getByText(/sessions|my sessions/i).first()).toBeVisible();
  });

  test('la pagina Messages si carica', async ({ page }) => {
    await page.goto('/dashboard/messages');
    await page.waitForLoadState('domcontentloaded');

    // Verifica che la pagina messaggi si carica
    await expect(page.getByText(/messages|conversations/i).first()).toBeVisible();
  });

  test('la pagina Action Items si carica', async ({ page }) => {
    await page.goto('/dashboard/action-items');
    await page.waitForLoadState('domcontentloaded');

    // Verifica che la pagina action items si carica
    await expect(page.getByText(/action items/i).first()).toBeVisible();
  });

  test('la pagina Settings si carica', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('domcontentloaded');

    // Verifica che la pagina settings si carica
    await expect(page.getByText(/settings/i).first()).toBeVisible();
  });

  test('la sidebar di navigazione ha i link corretti', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Verifica i link della sidebar client
    await expect(page.locator('a[href="/dashboard"]').first()).toBeVisible();
    await expect(page.locator('a[href="/dashboard/my-sessions"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/messages"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/action-items"]')).toBeVisible();
    await expect(page.locator('a[href="/dashboard/settings"]')).toBeVisible();
  });

  test('la navigazione dalla sidebar funziona', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Clicca su Messages nella sidebar
    await page.locator('a[href="/dashboard/messages"]').click();
    await page.waitForURL('**/dashboard/messages');

    // Clicca su Action Items
    await page.locator('a[href="/dashboard/action-items"]').click();
    await page.waitForURL('**/dashboard/action-items');
  });
});
