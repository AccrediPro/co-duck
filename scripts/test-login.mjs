import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3001/sign-in', { waitUntil: 'domcontentloaded', timeout: 12000 });
await page.waitForTimeout(3000);

await page.fill('#identifier-field', 'tettypottycoach@gmail.com');
await page.fill('#password-field', 'tettypottycoach');
await page.waitForTimeout(500);

const btns = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button[type=submit]')).map((b) => ({
    text: b.textContent?.trim(),
    visible: b.offsetParent !== null,
    disabled: b.disabled,
  }));
});
console.log('Submit buttons:', JSON.stringify(btns, null, 2));

// Try clicking first visible enabled submit
const submitBtns = await page.$$('button[type=submit]');
for (const btn of submitBtns) {
  const visible = await btn.isVisible();
  const disabled = await btn.isDisabled();
  const text = (await btn.innerText().catch(() => '')).trim();
  console.log(`Button: visible=${visible} disabled=${disabled} text="${text.slice(0, 50)}"`);
  if (visible && !disabled) {
    console.log('Clicking...');
    await btn.click({ timeout: 5000 });
    await page.waitForTimeout(4000);
    console.log('After click URL:', page.url());
    break;
  }
}

await browser.close();
