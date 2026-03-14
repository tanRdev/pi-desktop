import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/Users/tan/.superset/worktrees/PiDesk/battle-lamb/apps/web/screenshot4.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved');
})();
