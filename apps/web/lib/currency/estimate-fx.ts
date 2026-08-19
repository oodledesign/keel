import 'server-only';

import {
  SUPPORTED_WORKSPACE_CURRENCIES,
  type WorkspaceCurrency,
} from '~/lib/currency/workspace-currency';

/**
 * Mid-market units per £1 (fallback when live rates are unavailable).
 * Used only for invoice dashboard estimates, never for charging.
 */
export const FALLBACK_UNITS_PER_GBP: Record<WorkspaceCurrency, number> = {
  gbp: 1,
  usd: 1.27,
  eur: 1.17,
  aud: 1.95,
  cad: 1.76,
  nzd: 2.12,
  chf: 1.12,
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const ERROR_TTL_MS = 5 * 60 * 1000;
const FRANKFURTER_URL =
  'https://api.frankfurter.app/latest?from=GBP&to=USD,EUR,AUD,CAD,NZD,CHF';

let cache: {
  at: number;
  unitsPerGbp: Record<WorkspaceCurrency, number>;
  asOf: string | null;
  live: boolean;
} | null = null;

export function convertMinorUnits(
  amount: number,
  from: WorkspaceCurrency,
  to: WorkspaceCurrency,
  unitsPerGbp: Record<WorkspaceCurrency, number> = FALLBACK_UNITS_PER_GBP,
): number {
  if (from === to || amount === 0) return amount;
  const fromPerGbp = unitsPerGbp[from] || FALLBACK_UNITS_PER_GBP[from];
  const toPerGbp = unitsPerGbp[to] || FALLBACK_UNITS_PER_GBP[to];
  if (!fromPerGbp || !toPerGbp) return amount;
  return Math.round((amount / fromPerGbp) * toPerGbp);
}

export async function getUnitsPerGbp(): Promise<{
  unitsPerGbp: Record<WorkspaceCurrency, number>;
  asOf: string | null;
  live: boolean;
}> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return {
      unitsPerGbp: cache.unitsPerGbp,
      asOf: cache.asOf,
      live: cache.live,
    };
  }

  try {
    const response = await fetch(FRANKFURTER_URL, {
      signal: AbortSignal.timeout(2500),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`FX HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      date?: string;
      rates?: Record<string, number>;
    };
    const unitsPerGbp: Record<WorkspaceCurrency, number> = {
      ...FALLBACK_UNITS_PER_GBP,
    };
    for (const code of SUPPORTED_WORKSPACE_CURRENCIES) {
      if (code === 'gbp') continue;
      const rate = payload.rates?.[code.toUpperCase()];
      if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        unitsPerGbp[code] = rate;
      }
    }
    cache = {
      at: Date.now(),
      unitsPerGbp,
      asOf: payload.date ?? null,
      live: true,
    };
    return {
      unitsPerGbp: cache.unitsPerGbp,
      asOf: cache.asOf,
      live: true,
    };
  } catch {
    cache = {
      at: Date.now() - (CACHE_TTL_MS - ERROR_TTL_MS),
      unitsPerGbp: FALLBACK_UNITS_PER_GBP,
      asOf: null,
      live: false,
    };
    return {
      unitsPerGbp: FALLBACK_UNITS_PER_GBP,
      asOf: null,
      live: false,
    };
  }
}
