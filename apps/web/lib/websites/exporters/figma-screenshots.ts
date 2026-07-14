/**
 * Optional Playwright PNG capture for Figma Tier 0.
 * Guarded to Node server/queue context — never Edge.
 *
 * Playwright is optional: if missing or Chromium is not installed,
 * capture returns null and the pack documents the skip.
 */
import 'server-only';

import { createRequire } from 'node:module';

export type FigmaScreenshotResult = {
  png: Uint8Array | null;
  skippedReason?: string;
};

type PlaywrightBrowser = {
  newPage: (options?: {
    viewport?: { width: number; height: number };
    deviceScaleFactor?: number;
  }) => Promise<{
    goto: (
      url: string,
      options?: { waitUntil?: string; timeout?: number },
    ) => Promise<unknown>;
    waitForSelector: (
      selector: string,
      options?: { timeout?: number },
    ) => Promise<unknown>;
    locator: (selector: string) => {
      screenshot: (options?: { type?: string }) => Promise<Buffer>;
    };
  }>;
  close: () => Promise<void>;
};

type PlaywrightModule = {
  chromium: {
    launch: (options?: {
      headless?: boolean;
      args?: string[];
    }) => Promise<PlaywrightBrowser>;
  };
};

function loadPlaywright(): PlaywrightModule | null {
  try {
    const require = createRequire(import.meta.url);
    return require('playwright') as PlaywrightModule;
  } catch {
    return null;
  }
}

/**
 * Navigate to a chrome-less wireframe URL and return a PNG screenshot.
 * Returns null when Playwright/Chromium is unavailable.
 */
export async function captureFigmaWireframePng(
  absoluteUrl: string,
  options?: { timeoutMs?: number; width?: number },
): Promise<FigmaScreenshotResult> {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return {
      png: null,
      skippedReason: 'Edge runtime — Playwright capture is Node-only',
    };
  }

  if (process.env.FIGMA_PNG_CAPTURE === '0') {
    return {
      png: null,
      skippedReason: 'FIGMA_PNG_CAPTURE=0',
    };
  }

  const playwright = loadPlaywright();
  if (!playwright?.chromium) {
    return {
      png: null,
      skippedReason:
        'playwright package not installed — run pnpm add -D playwright && pnpm exec playwright install chromium',
    };
  }

  const width = options?.width ?? 1440;
  const timeout = options?.timeoutMs ?? 45_000;
  let browser: PlaywrightBrowser | null = null;

  try {
    browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });
    await page.goto(absoluteUrl, {
      waitUntil: 'networkidle',
      timeout,
    });
    await page.waitForSelector('[data-figma-wireframe-root]', {
      timeout: Math.min(timeout, 20_000),
    });
    const png = await page
      .locator('[data-figma-wireframe-root]')
      .screenshot({ type: 'png' });
    return { png: new Uint8Array(png) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown screenshot failure';
    return { png: null, skippedReason: message };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function captureFigmaWireframePngMap(
  urlsBySlug: Record<string, string>,
  options?: { maxPages?: number; deadlineMs?: number },
): Promise<{
  pagePngs: Record<string, Uint8Array>;
  notes: string[];
}> {
  const pagePngs: Record<string, Uint8Array> = {};
  const notes: string[] = [];
  const maxPages = options?.maxPages ?? 6;
  const deadlineMs = options?.deadlineMs ?? 50_000;
  const started = Date.now();

  const entries = Object.entries(urlsBySlug).slice(0, maxPages);
  if (Object.keys(urlsBySlug).length > maxPages) {
    notes.push(
      `Skipped ${Object.keys(urlsBySlug).length - maxPages} page(s) — capture capped at ${maxPages}`,
    );
  }

  for (const [slug, url] of entries) {
    if (Date.now() - started > deadlineMs) {
      notes.push(`${slug}: skipped — capture deadline reached`);
      continue;
    }
    const result = await captureFigmaWireframePng(url, {
      timeoutMs: Math.min(20_000, deadlineMs - (Date.now() - started)),
    });
    if (result.png) {
      pagePngs[slug] = result.png;
    } else if (result.skippedReason) {
      notes.push(`${slug}: ${result.skippedReason}`);
    }
  }

  return { pagePngs, notes };
}
