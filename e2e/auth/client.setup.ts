import { test as setup, expect } from '@playwright/test';

const CLIENT_EMAIL = 'tettypottyclient@gmail.com';
const CLIENT_PASSWORD = 'tettypottyclient';

setup('login come client e salva stato auth', async ({ page }) => {
  await page.goto('/sign-in');

  // Clerk sign-in: attendi e inserisci email
  const emailInput = page.locator('input[name="identifier"]');
  await emailInput.waitFor({ state: 'visible', timeout: 20_000 });
  await emailInput.fill(CLIENT_EMAIL);

  // Clicca continua
  await page.getByRole('button', { name: /continue/i }).click();

  // Inserisci password
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ state: 'visible', timeout: 15_000 });
  await passwordInput.fill(CLIENT_PASSWORD);

  // Clicca continua per login
  await page.getByRole('button', { name: /continue/i }).click();

  // Attendi redirect alla dashboard
  await page.waitForURL('**/dashboard**', { timeout: 30_000 });
  await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });

  // Salva stato di autenticazione
  await page.context().storageState({ path: 'e2e/.auth/client.json' });
});
