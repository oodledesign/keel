/** Competitor Tracker constants (commercial market watch). */

export const COMPETITOR_CATEGORIES = [
  'industrial',
  'retail',
  'development',
] as const;

export type CompetitorCategory = (typeof COMPETITOR_CATEGORIES)[number];

export const COMPETITOR_CATEGORY_LABELS: Record<CompetitorCategory, string> = {
  industrial: 'Industrial',
  retail: 'Retail',
  development: 'Development',
};

export const COMPETITOR_STATUSES = [
  'watching',
  'under_offer',
  'let_sold',
  'withdrawn',
] as const;

export type CompetitorStatus = (typeof COMPETITOR_STATUSES)[number];

export const COMPETITOR_STATUS_LABELS: Record<CompetitorStatus, string> = {
  watching: 'Watching',
  under_offer: 'Under offer',
  let_sold: 'Let / sold',
  withdrawn: 'Withdrawn',
};

export const COMPETITOR_TENURES = [
  'sale',
  'to_let',
  'both',
  'unknown',
] as const;

export type CompetitorTenure = (typeof COMPETITOR_TENURES)[number];

export const COMPETITOR_TENURE_LABELS: Record<CompetitorTenure, string> = {
  sale: 'For sale',
  to_let: 'To let',
  both: 'Sale / to let',
  unknown: 'Unknown',
};

export function normalizeCompetitorCategory(
  value: string | null | undefined,
): CompetitorCategory {
  const key = (value ?? '').trim().toLowerCase();
  if (key === 'industrial' || key === 'ind') return 'industrial';
  if (key === 'retail' || key === 'high street' || key === 'highstreet') {
    return 'retail';
  }
  if (key === 'development' || key === 'dev' || key === 'land') {
    return 'development';
  }
  return 'industrial';
}

export function normalizeCompetitorStatus(
  value: string | null | undefined,
): CompetitorStatus {
  const key = (value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (key === 'under_offer' || key === 'uo' || key === 'under offer') {
    return 'under_offer';
  }
  if (
    key === 'let_sold' ||
    key === 'let' ||
    key === 'sold' ||
    key === 'completed'
  ) {
    return 'let_sold';
  }
  if (key === 'withdrawn' || key === 'off_market') return 'withdrawn';
  return 'watching';
}

export function normalizeCompetitorTenure(
  value: string | null | undefined,
): CompetitorTenure | null {
  const key = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[/\s-]+/g, '_');
  if (!key) return null;
  if (key === 'sale' || key === 'for_sale' || key === 'fs' || key === 'fh') {
    return 'sale';
  }
  if (
    key === 'to_let' ||
    key === 'let' ||
    key === 'rent' ||
    key === 'lease' ||
    key === 'lh'
  ) {
    return 'to_let';
  }
  if (key === 'both' || key === 'sale_to_let') return 'both';
  return 'unknown';
}

export function parsePriceToPence(
  raw: string | null | undefined,
): number | null {
  if (raw == null) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/£/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '');
  if (!cleaned) return null;
  const match = cleaned.match(/^([\d.]+)(k|m)?$/i);
  if (!match) {
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  }
  let n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  const suffix = (match[2] ?? '').toLowerCase();
  if (suffix === 'k') n *= 1_000;
  if (suffix === 'm') n *= 1_000_000;
  return Math.round(n * 100);
}

export function formatCompetitorPricePence(
  pence: number | null | undefined,
): string {
  if (pence == null || !Number.isFinite(pence)) return '';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}
