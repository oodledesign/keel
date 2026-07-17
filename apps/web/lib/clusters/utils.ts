export const LOCATION_CODES: Record<string, number> = {
  gb: 2826,
  us: 2840,
  au: 2036,
  ca: 2124,
  ie: 2372,
  nz: 2554,
  za: 2710,
};

export function countryToLocationCode(country: string): number {
  const code = LOCATION_CODES[country.toLowerCase()];
  if (!code) {
    throw new Error(`Unsupported country code: ${country}`);
  }
  return code;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function deduplicateBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item).toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string,
): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function normaliseUrl(url: string): string {
  return (
    url
      .replace(/^https?:\/\/(www\.)?/i, '')
      .replace(/\/$/, '')
      .split('?')[0] ?? url
  );
}

export function titleCaseKeyword(keyword: string): string {
  return keyword
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function normalise(value: number, values: number[]): number {
  if (values.length === 0) return 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 1;
  return (value - min) / (max - min);
}

export function intentWeight(intent: string): number {
  const weights: Record<string, number> = {
    commercial: 1.0,
    transactional: 0.9,
    informational: 0.5,
    navigational: 0.2,
  };
  return weights[intent] ?? 0.5;
}
