// E2E verification for the StrictMode "stuck on Loading blueprint" regression.
// Opens /editor/{id} in a real browser and asserts the editor reaches ready
// state. Seed first: `npx tsx scripts/seed-e2e-blueprint.ts`
// Usage: dev server on :3000, then `node scripts/e2e-new-blueprint.mjs`

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const BLUEPRINT_ID = process.env.E2E_BLUEPRINT_ID ?? 'e2e-seed-blueprint';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

  await page.goto(`${BASE}/editor/${BLUEPRINT_ID}`, { waitUntil: 'domcontentloaded' });

  // The bug: editor stayed on "Loading blueprint…" forever under StrictMode.
  const loading = page.getByText(/Loading blueprint/i);
  if (await loading.isVisible().catch(() => false)) {
    await loading.waitFor({ state: 'detached', timeout: 20000 });
  }

  const notFound = await page.getByText(/Blueprint not found/i).isVisible().catch(() => false);
  if (notFound) {
    console.error('FAIL  blueprint not found');
    process.exitCode = 1;
  } else {
    const palette = await page.getByRole('button', { name: /Catalogue/i }).isVisible().catch(() => false);
    console.log(palette ? 'PASS  editor reached ready state' : 'FAIL  palette not visible');
    process.exitCode = palette ? 0 : 1;
  }

  await browser.close();
}

main().catch((error) => {
  console.error('E2E failed:', error.message);
  process.exitCode = 1;
});
