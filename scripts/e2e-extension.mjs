// Loads the built extension into Chromium (Playwright, --load-extension) and checks the app page.
// Usage: node scripts/e2e-extension.mjs [--shots <dir>]
// Needs: `npm run build` and `npm run build:mock` first, and a Chromium that Playwright can find.
import { chromium } from 'playwright-core';
import { mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const shotsIdx = process.argv.indexOf('--shots');
const shotsDir = shotsIdx > -1 ? resolve(process.argv[shotsIdx + 1]) : null;
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function withExtension(dir, fn) {
  if (!existsSync(join(dir, 'manifest.json'))) throw new Error(`${dir} has no manifest.json (build first)`);
  const profile = mkdtempSync(join(tmpdir(), 'seance-e2e-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`, '--no-sandbox']
  });
  try {
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    const id = new URL(sw.url()).host;
    await fn(ctx, id, sw);
  } finally {
    await ctx.close();
  }
}

async function open(ctx, id, query = '') {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`chrome-extension://${id}/app/index.html${query}`);
  await page.waitForSelector('[data-testid="chip-firebase"]');
  return { page, errors };
}

const text = (page, id) => page.locator(`[data-testid="${id}"]`).innerText();
const shot = async (page, name) => { if (shotsDir) await page.screenshot({ path: join(shotsDir, name), fullPage: true }); };

// 1) Mock flavor: scripted Firebase AI Logic layer
await withExtension(resolve('dist-mock'), async (ctx, id, sw) => {
  check('mock: service worker registered', sw.url().endsWith('/background/sw.js'), sw.url());

  let { page, errors } = await open(ctx, id, '?device=available');
  check('mock: MOCK banner visible', (await page.content()).includes('MOCK'));
  check('mock: firebase chip says mock', /mock/i.test(await text(page, 'chip-firebase')));
  await page.click('[data-testid="btn-run-device"]');
  await page.waitForFunction(() => (document.querySelector('[data-testid="path-badge"]')?.textContent ?? '').trim().length > 0);
  check('mock/available: on-device run -> "Ran on-device"', (await text(page, 'path-badge')).trim() === 'Ran on-device');
  check('mock/available: requested mode shown', /only_on_device/i.test(await text(page, 'mode-requested')));
  await shot(page, 'mock-available-on-device.png');
  await page.click('[data-testid="btn-run-cloud"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="path-badge"]')?.textContent?.trim() === 'Ran in cloud');
  check('mock/available: cloud run -> "Ran in cloud"', true);
  await shot(page, 'mock-available-cloud.png');
  check('mock/available: no page errors', errors.length === 0, errors.join(' | '));
  await page.close();

  ({ page } = await open(ctx, id, '?device=unavailable'));
  await page.click('[data-testid="btn-run-hybrid"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="path-badge"]')?.textContent?.trim() === 'Ran in cloud');
  check('mock/unavailable: hybrid (prefer on-device) falls back -> "Ran in cloud"', true);
  await shot(page, 'mock-unavailable-hybrid-fallback.png');
  await page.click('[data-testid="btn-run-device"]');
  await page.waitForFunction(() => (document.querySelector('[data-testid="probe-error"]')?.textContent ?? '').trim().length > 0);
  const err = await text(page, 'probe-error');
  check('mock/unavailable: on-device-only shows error, no silent cloud', /on-device/i.test(err), err);
  await shot(page, 'mock-unavailable-device-only-error.png');
  await page.close();

  ({ page } = await open(ctx, id, '?device=downloadable'));
  check('mock/downloadable: chip shows downloadable', /downloadable/i.test(await text(page, 'chip-device')));
  await page.click('[data-testid="btn-enable-device"]');
  await page.waitForFunction(() => /available/i.test(document.querySelector('[data-testid="chip-device"]')?.textContent ?? '') && !/downloadable/i.test(document.querySelector('[data-testid="chip-device"]')?.textContent ?? ''));
  check('mock/downloadable: Enable on-device AI -> chip becomes available', true);
  await shot(page, 'mock-downloadable-enabled.png');
  await page.close();
});

// 2) Real build, no Firebase config: must render and explain what is missing, never call out
await withExtension(resolve('dist'), async (ctx, id) => {
  const { page, errors } = await open(ctx, id);
  const html = await page.content();
  check('real: no MOCK banner', !html.includes('MOCK'));
  const chip = await text(page, 'chip-firebase');
  check('real: firebase chip reports missing config', /missing/i.test(chip), chip);
  for (const b of ['btn-run-device', 'btn-run-hybrid', 'btn-run-cloud']) {
    check(`real: ${b} disabled without config`, await page.locator(`[data-testid="${b}"]`).isDisabled());
  }
  await shot(page, 'real-no-config.png');
  check('real: no page errors', errors.length === 0, errors.join(' | '));
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
