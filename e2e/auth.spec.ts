import { test, expect } from '@playwright/test';

test.describe('Autenticazione', () => {
  test('il sign-in come client funziona', async ({ page }) => {
    await page.goto('/sign-in');

    // Clerk sign-in: attendi e inserisci email
    const emailInput = page.locator('input[name="identifier"]');
    await emailInput.waitFor({ state: 'visible', timeout: 20_000 });
    await emailInput.fill('tettypottyclient@gmail.com');

    // Clicca continua
    await page.getByRole('button', { name: /continue/i }).click();

    // Inserisci password
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.waitFor({ state: 'visible', timeout: 15_000 });
    await passwordInput.fill('tettypottyclient');

    // Clicca continua
    await page.getByRole('button', { name: /continue/i }).click();

    // Verifica redirect alla dashboard
    await page.waitForURL('**/dashboard**', { timeout: 30_000 });
    await expect(page.locator('h1')).toContainText('Dashboard', { timeout: 10_000 });
  });

  test('il sign-in come coach funziona', async ({ page }) => {
    await page.goto('/sign-in');

    // Clerk sign-in: attendi e inserisci email
    const emailInput = page.locator('input[name="identifier"]');
    await emailInput.waitFor({ state: 'visible', timeout: 20_000 });
    await emailInput.fill('tettypottycoach@gmail.com');

    // Clicca continua
    await page.getByRole('button', { name: /continue/i }).click();

    // Inserisci password
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.waitFor({ state: 'visible', timeout: 15_000 });
    await passwordInput.fill('tettypottycoach');

    // Clicca continua
    await page.getByRole('button', { name: /continue/i }).click();

    // Verifica redirect alla dashboard
    await page.waitForURL('**/dashboard**', { timeout: 30_000 });
    await expect(page.locator('h1')).toContainText('Dashboard', { timeout: 10_000 });
  });

  test('le route protette reindirizzano al sign-in se non autenticati', async ({ page }) => {
    await page.goto('/dashboard');

    // Verifica che Clerk reindirizza alla pagina di sign-in
    await page.waitForURL(/sign-in/, { timeout: 15_000 });
    await expect(page).toHaveURL(/sign-in/);
  });

  test('le sottopagine protette reindirizzano al sign-in', async ({ page }) => {
    await page.goto('/dashboard/messages');

    await page.waitForURL(/sign-in/, { timeout: 15_000 });
    await expect(page).toHaveURL(/sign-in/);
  });
});
