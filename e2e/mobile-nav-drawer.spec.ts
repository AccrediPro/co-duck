import { test, expect } from '@playwright/test';

const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 812;

test.describe('G3: Mobile Navigation Drawer', () => {
  test.use({
    viewport: { width: MOBILE_WIDTH, height: MOBILE_HEIGHT },
    storageState: 'e2e/.auth/coach.json',
  });

  test('hamburger button is visible on mobile and meets 44px touch target', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Desktop sidebar should be hidden on mobile
    const sidebar = page.locator('aside');
    if ((await sidebar.count()) > 0) {
      await expect(sidebar.first()).not.toBeVisible();
    }

    // Hamburger button should be visible
    const hamburger = page.getByRole('button', { name: /open navigation menu/i });
    await expect(hamburger).toBeVisible();

    // Verify touch target size >= 44px
    const box = await hamburger.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('drawer opens on hamburger click and shows navigation links', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Click hamburger
    const hamburger = page.getByRole('button', { name: /open navigation menu/i });
    await hamburger.click();

    // Wait for drawer to open - Sheet renders as a dialog
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Verify nav links are present inside the drawer
    const overviewLink = drawer.getByRole('link', { name: /overview/i });
    await expect(overviewLink).toBeVisible();

    const sessionsLink = drawer.getByRole('link', { name: /sessions/i });
    await expect(sessionsLink).toBeVisible();

    const settingsLink = drawer.getByRole('link', { name: /settings/i });
    await expect(settingsLink).toBeVisible();

    const messagesLink = drawer.getByRole('link', { name: /messages/i });
    await expect(messagesLink).toBeVisible();
  });

  test('drawer closes via close button', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open drawer
    const hamburger = page.getByRole('button', { name: /open navigation menu/i });
    await hamburger.click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Close via X button
    const closeBtn = drawer.getByRole('button', { name: /close/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await expect(drawer).not.toBeVisible();
  });

  test('drawer closes via overlay click', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open drawer
    const hamburger = page.getByRole('button', { name: /open navigation menu/i });
    await hamburger.click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Click on overlay (far right side of viewport)
    await page.mouse.click(MOBILE_WIDTH - 10, MOBILE_HEIGHT / 2);

    await expect(drawer).not.toBeVisible();
  });

  test('drawer closes via Escape key', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open drawer
    const hamburger = page.getByRole('button', { name: /open navigation menu/i });
    await hamburger.click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    await expect(drawer).not.toBeVisible();
  });

  test('navigation link click navigates and closes drawer', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open drawer
    const hamburger = page.getByRole('button', { name: /open navigation menu/i });
    await hamburger.click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Click Settings link
    const settingsLink = drawer.getByRole('link', { name: /settings/i });
    await settingsLink.click();

    // Should navigate to settings
    await page.waitForURL('**/dashboard/settings**');
    expect(page.url()).toContain('/dashboard/settings');

    // Drawer should be closed
    await expect(drawer).not.toBeVisible();
  });

  test('active page is highlighted in drawer', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open drawer
    const hamburger = page.getByRole('button', { name: /open navigation menu/i });
    await hamburger.click();

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Overview should be active (has bg-primary class)
    const overviewLink = drawer.getByRole('link', { name: /overview/i });
    await expect(overviewLink).toHaveClass(/bg-primary/);
  });
});

test.describe('G3: Desktop sidebar unchanged', () => {
  test.use({
    viewport: { width: 1280, height: 720 },
    storageState: 'e2e/.auth/coach.json',
  });

  test('desktop sidebar is visible at >=768px', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Desktop sidebar should be visible
    const sidebar = page.locator('aside');
    await expect(sidebar.first()).toBeVisible();

    // Mobile header should be hidden
    const mobileHeader = page.locator('header.md\\:hidden');
    if ((await mobileHeader.count()) > 0) {
      await expect(mobileHeader.first()).not.toBeVisible();
    }
  });
});
