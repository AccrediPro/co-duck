import { test, expect } from '@playwright/test';

test.describe('Messaggistica', () => {
  test('la pagina messaggi si carica con la lista conversazioni', async ({ page }) => {
    await page.goto('/dashboard/messages');
    await page.waitForLoadState('domcontentloaded');

    // Verifica che la pagina messaggi si carica
    await expect(page.getByText(/messages|conversations/i).first()).toBeVisible();
  });

  test('il client può aprire una conversazione', async ({ page }) => {
    await page.goto('/dashboard/messages');
    await page.waitForLoadState('networkidle');

    // Cerca una conversazione nella lista
    const conversation = page.locator('a[href^="/dashboard/messages/"]').first();
    const hasConversation = await conversation.isVisible().catch(() => false);

    if (hasConversation) {
      await conversation.click();
      await page.waitForLoadState('domcontentloaded');

      // Verifica che la chat si apre (input messaggio o area messaggi)
      const chatArea = page.locator('textarea, input[placeholder*="message" i], input[placeholder*="type" i]').first();
      await expect(chatArea).toBeVisible({ timeout: 10_000 });
    } else {
      // Nessuna conversazione — verifica messaggio vuoto
      const emptyMessage = await page.getByText(/no conversations|no messages|start a conversation/i).isVisible().catch(() => false);
      expect(emptyMessage).toBeTruthy();
    }
  });

  test('il client può digitare un messaggio', async ({ page }) => {
    await page.goto('/dashboard/messages');
    await page.waitForLoadState('networkidle');

    const conversation = page.locator('a[href^="/dashboard/messages/"]').first();
    const hasConversation = await conversation.isVisible().catch(() => false);

    if (!hasConversation) {
      test.skip();
      return;
    }

    await conversation.click();
    await page.waitForLoadState('networkidle');

    // Trova l'input per il messaggio
    const messageInput = page.locator('textarea, input[placeholder*="message" i], input[placeholder*="type" i]').first();
    await messageInput.waitFor({ state: 'visible', timeout: 10_000 });

    // Digita un messaggio di test
    const testMessage = `Test E2E - ${Date.now()}`;
    await messageInput.fill(testMessage);

    // Verifica che il testo è stato inserito
    await expect(messageInput).toHaveValue(testMessage);
  });

  test('il client può inviare un messaggio', async ({ page }) => {
    await page.goto('/dashboard/messages');
    await page.waitForLoadState('networkidle');

    const conversation = page.locator('a[href^="/dashboard/messages/"]').first();
    const hasConversation = await conversation.isVisible().catch(() => false);

    if (!hasConversation) {
      test.skip();
      return;
    }

    await conversation.click();
    await page.waitForLoadState('networkidle');

    const messageInput = page.locator('textarea, input[placeholder*="message" i], input[placeholder*="type" i]').first();
    await messageInput.waitFor({ state: 'visible', timeout: 10_000 });

    // Invia un messaggio
    const testMessage = `Messaggio test Playwright - ${Date.now()}`;
    await messageInput.fill(testMessage);

    // Cerca il pulsante invio
    const sendButton = page.getByRole('button', { name: /send/i }).first();
    const sendExists = await sendButton.isVisible().catch(() => false);

    if (sendExists) {
      await sendButton.click();
    } else {
      // Prova con Enter
      await messageInput.press('Enter');
    }

    // Attendi che il messaggio appaia nella chat
    await page.waitForTimeout(2000);

    // Verifica che il messaggio inviato sia visibile nella chat
    const messageSent = await page.getByText(testMessage).isVisible().catch(() => false);
    expect(messageSent).toBeTruthy();
  });
});
