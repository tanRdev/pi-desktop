import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Click on the MCP dropdown
  await page.click('[class*="inline-flex"][class*="gap-1.5"]');
  await page.waitForTimeout(500);
  
  await page.screenshot({ path: '/Users/tan/.superset/worktrees/PiDesk/battle-lamb/apps/web/screenshot9.png', fullPage: false });
  await browser.close();
  console.log('Screenshot saved');
})();
