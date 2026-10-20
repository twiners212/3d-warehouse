import { chromium } from 'playwright';

const BASE = 'http://localhost:3003';

async function capture() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Navigating to login page...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'docs/assets/login-preview.png' });
  console.log('Captured login-preview.png');

  console.log('Logging in as admin...');
  await page.fill('input[type="email"]', 'admin@warehouse.local');
  await page.fill('input[type="password"]', 'admin12345');
  await page.click('button[type="submit"]');

  console.log('Waiting for dashboard...');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'docs/assets/dashboard-preview.png' });
  console.log('Captured dashboard-preview.png');

  // Try to open first blueprint editor
  const editButtons = page.locator('a[href*="/editor/"]');
  const count = await editButtons.count();
  if (count > 0) {
    console.log(`Found ${count} blueprints, navigating to editor...`);
    const href = await editButtons.first().getAttribute('href');
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
    // Wait for canvas or loading screen to settle
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'docs/assets/editor-3d-preview.png' });
    console.log('Captured editor-3d-preview.png');
  }

  await browser.close();
  console.log('All screenshots captured successfully.');
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
