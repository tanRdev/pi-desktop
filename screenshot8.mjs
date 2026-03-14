import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/Users/tan/.superset/worktrees/PiDesk/battle-lamb/apps/web/screenshot8.png', fullPage: false });
  await browser.close();
  console.log('Screenshot saved');
})();
