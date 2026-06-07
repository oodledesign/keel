export function normaliseOverviewDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    ?.toLowerCase() ?? domain.toLowerCase();
}

export function projectCountryToCode(country: string | null | undefined): string {
  const raw = (country ?? 'gb').trim().toLowerCase();
  if (raw === 'uk') return 'gb';
  if (raw === 'us' || raw === 'usa') return 'us';
  return raw.slice(0, 2);
}
