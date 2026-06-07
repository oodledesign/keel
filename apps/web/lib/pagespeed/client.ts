import 'server-only';

import type { PagespeedStrategy, ParsedPagespeedResult } from './types';

const PSI_BASE = 'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed';

function getApiKey(): string {
  const key =
    process.env.GOOGLE_PAGESPEED_API_KEY?.trim() ??
    process.env.GOOGLE_API_KEY?.trim();

  if (!key) {
    throw new Error(
      'PageSpeed Insights is not configured. Set GOOGLE_PAGESPEED_API_KEY.',
    );
  }

  return key;
}

function scoreFromCategory(
  categories: Record<string, { score?: number | null }> | undefined,
  key: string,
): number | null {
  const score = categories?.[key]?.score;
  if (score == null || Number.isNaN(score)) return null;
  return Math.round(score * 100);
}

function auditValue(
  audits: Record<string, { numericValue?: number | null }> | undefined,
  key: string,
): number | null {
  const value = audits?.[key]?.numericValue;
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 1000) / 1000;
}

export function parsePagespeedResponse(json: Record<string, unknown>): ParsedPagespeedResult {
  const lighthouse = json.lighthouseResult as
    | {
        categories?: Record<string, { score?: number | null }>;
        audits?: Record<string, { numericValue?: number | null }>;
      }
    | undefined;

  const categories = lighthouse?.categories;
  const audits = lighthouse?.audits;

  return {
    performanceScore: scoreFromCategory(categories, 'performance'),
    accessibilityScore: scoreFromCategory(categories, 'accessibility'),
    bestPracticesScore: scoreFromCategory(categories, 'best-practices'),
    seoScore: scoreFromCategory(categories, 'seo'),
    lcpMs: auditValue(audits, 'largest-contentful-paint'),
    fcpMs: auditValue(audits, 'first-contentful-paint'),
    cls: auditValue(audits, 'cumulative-layout-shift'),
    tbtMs: auditValue(audits, 'total-blocking-time'),
    speedIndexMs: auditValue(audits, 'speed-index'),
  };
}

export async function fetchPagespeedInsights(input: {
  url: string;
  strategy: PagespeedStrategy;
}): Promise<ParsedPagespeedResult> {
  const params = new URLSearchParams({
    url: input.url,
    strategy: input.strategy,
    key: getApiKey(),
  });

  for (const category of [
    'performance',
    'accessibility',
    'best-practices',
    'seo',
  ]) {
    params.append('category', category);
  }

  const res = await fetch(`${PSI_BASE}?${params.toString()}`, {
    method: 'GET',
    signal: AbortSignal.timeout(120_000),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PageSpeed Insights failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as Record<string, unknown>;
  return parsePagespeedResponse(json);
}
