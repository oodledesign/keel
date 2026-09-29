/**
 * Capture 2x product screenshots for the marketing site from a local,
 * seeded demo workspace (apps/web/scripts/seed-marketing-demo-agency.mts).
 *
 *   OZER_CAPTURE_ACCOUNT=harland-reed OZER_CAPTURE_LISTING_ID=<uuid> \
 *   OZER_CAPTURE_BROCHURE_TOKEN=<token> OZER_CAPTURE_EMAIL=<email> \
 *   OZER_CAPTURE_PASSWORD=<password> \
 *   pnpm --filter web exec tsx ../e2e/scripts/capture-marketing-screens.ts
 *
 * Writes apps/web/public/brand/marketing/commercial/<name>.webp
 */
import { type Page, chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '../../web');
const outDir = resolve(webRoot, 'public/brand/marketing/commercial');

const sharp = createRequire(resolve(webRoot, 'package.json'))(
  'sharp',
) as typeof import('sharp');

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const baseUrl = process.env.OZER_CAPTURE_BASE_URL ?? 'http://localhost:3000';

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl)) {
  throw new Error('Capture runs against a local dev server only.');
}

const account = env('OZER_CAPTURE_ACCOUNT');
const listingId = env('OZER_CAPTURE_LISTING_ID');
const brochureToken = env('OZER_CAPTURE_BROCHURE_TOKEN');

type Shot = {
  name: string;
  path: string;
  before?: (page: Page) => Promise<void>;
  selector?: string;
};

const SHOTS: Shot[] = [
  { name: 'agency-home', path: `/home/${account}` },
  {
    name: 'publish-panel',
    path: `/home/${account}/listings/${listingId}/publishing`,
  },
  { name: 'requirements-match', path: `/home/${account}/requirements` },
  { name: 'circulation', path: `/home/${account}/circulation` },
  { name: 'pipeline-wip', path: `/home/${account}/pipeline` },
  { name: 'brochure-share', path: `/share/brochure/${brochureToken}` },
  {
    name: 'ask-ai',
    path: `/home/${account}/listings`,
    before: async (page) => {
      await page.click('[data-test="disposals-ask-ai"]');
      await page.waitForSelector('[role="dialog"]');
    },
    selector: '[role="dialog"]',
  },
];

async function main() {
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/auth/sign-in`);
  await page.fill('input[name="email"]', env('OZER_CAPTURE_EMAIL'));
  await page.fill('input[name="password"]', env('OZER_CAPTURE_PASSWORD'));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/home/, { timeout: 60_000 });

  for (const shot of SHOTS) {
    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: 'networkidle' });
    await shot.before?.(page);
    await page.waitForTimeout(600);

    const png = shot.selector
      ? await page.locator(shot.selector).screenshot()
      : await page.screenshot();

    const file = resolve(outDir, `${shot.name}.webp`);
    writeFileSync(file, await sharp(png).webp({ quality: 84 }).toBuffer());
    console.log(`Saved ${file}`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
