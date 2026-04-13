import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3001/sign-in', { waitUntil: 'domcontentloaded', timeout: 12000 });
await page.waitForTimeout(3000);

await page.fill('#identifier-field', 'tettypottycoach@gmail.com');
await page.fill('#password-field', 'tettypottycoach');
await page.waitForTimeout(500);

// Try pressing Enter on the password field
console.log('Pressing Enter...');
await page.press('#password-field', 'Enter');
await page.waitForTimeout(5000);
console.log('URL after Enter:', page.url());

if (page.url().includes('sign-in')) {
  console.log('Trying force click on submit button...');
  await page
    .click('button[type=submit]', { force: true, timeout: 5000 })
    .catch((e) => console.log('force click error:', e.message));
  await page.waitForTimeout(5000);
  console.log('URL after force click:', page.url());
}

await browser.close();
