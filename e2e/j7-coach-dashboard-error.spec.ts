import { test, expect } from '@playwright/test';

test('J7 - check console errors on dashboard', async ({ page }) => {
  const errors: string[] = [];
  const networkErrors: string[] = [];
  
  page.on('console', msg => { 
    if (msg.type() === 'error') errors.push(msg.text()); 
  });
  page.on('response', response => {
    if (response.status() >= 500) networkErrors.push(`${response.status()} ${response.url()}`);
  });
  
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('Console errors:', JSON.stringify(errors));
  console.log('Network 5xx errors:', JSON.stringify(networkErrors));
  
  await page.screenshot({ path: '/tmp/j7-error-check.png' });
});
