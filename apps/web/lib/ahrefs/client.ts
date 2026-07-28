import 'server-only';

/**
 * Ahrefs free Domain Rating API.
 * Docs: https://docs.ahrefs.com/en/api/reference/public/get-domain-rating-free
 * License: http://ahrefs.com/legal/domain-rating-license
 * Attribution required: "Domain Rating by Ahrefs" (https://ahrefs.com/)
 *
 * Free / does not consume API units. Auth optional until 2026-08-10, then
 * a free API key is required (`AHREFS_API_KEY`).
 */

const AHREFS_API_KEY = process.env.AHREFS_API_KEY ?? '';
const AHREFS_DR_URL = 'https://api.ahrefs.com/v3/public/domain-rating-free';
const FETCH_CONCURRENCY = 5;

export type AhrefsDrResult = {
  domain: string;
  domain_rating: number | null;
  license: string | null;
  error: string | null;
};

type AhrefsDrApiResponse = {
  domain_rating?: {
    domain_rating?: number;
    license?: string;
    warning?: string | null;
  };
  error?: string;
};

export function normaliseAhrefsDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
}

function emptyResult(domain: string, error = 'not_found'): AhrefsDrResult {
  return {
    domain,
    domain_rating: null,
    license: null,
    error,
  };
}

async function fetchOneDomainRating(domain: string): Promise<AhrefsDrResult> {
  const target = normaliseAhrefsDomain(domain);
  if (!target) return emptyResult(domain, 'invalid_domain');

  try {
    const params = new URLSearchParams({
      target,
      output: 'json',
    });

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (AHREFS_API_KEY) {
      headers.Authorization = `Bearer ${AHREFS_API_KEY}`;
    }

    const res = await fetch(`${AHREFS_DR_URL}?${params.toString()}`, {
      headers,
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      console.error(`Ahrefs DR API error for ${target}: ${res.status}`);
      return emptyResult(target, `http_${res.status}`);
    }

    const data = (await res.json()) as AhrefsDrApiResponse;

    if (data.error) {
      return emptyResult(target, data.error);
    }

    const rating = data.domain_rating?.domain_rating;
    if (typeof rating !== 'number' || Number.isNaN(rating)) {
      return emptyResult(target, 'missing_rating');
    }

    return {
      domain: target,
      domain_rating: Math.round(rating * 10) / 10,
      license: data.domain_rating?.license ?? null,
      error: null,
    };
  } catch (err) {
    console.error('Ahrefs DR fetch failed:', err);
    return emptyResult(normaliseAhrefsDomain(domain), 'fetch_failed');
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];

  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]!);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function getDomainRatings(
  domains: string[],
): Promise<Record<string, AhrefsDrResult>> {
  if (!domains.length) return {};

  const unique = [...new Set(domains.map(normaliseAhrefsDomain))].filter(
    Boolean,
  );
  const fetched = await mapPool(
    unique,
    FETCH_CONCURRENCY,
    fetchOneDomainRating,
  );

  const results: Record<string, AhrefsDrResult> = {};
  for (const item of fetched) {
    results[item.domain] = item;
  }
  return results;
}

export async function getDomainRating(domain: string): Promise<AhrefsDrResult> {
  const key = normaliseAhrefsDomain(domain);
  const results = await getDomainRatings([domain]);
  return results[key] ?? emptyResult(key);
}

/** Integer 0–100 for badges / storage; null when unavailable. */
export function ahrefsDrInteger(
  result: AhrefsDrResult | undefined,
): number | null {
  if (result?.domain_rating == null) return null;
  return Math.round(result.domain_rating);
}
