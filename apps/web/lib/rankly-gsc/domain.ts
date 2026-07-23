/** Normalize a host/domain for GSC property matching. */
export function normalizeDomainHost(input: string): string {
  let value = input.trim().toLowerCase();
  if (!value) return '';

  value = value.replace(/^sc-domain:/, '');

  if (value.includes('://')) {
    try {
      value = new URL(value).hostname;
    } catch {
      value = value.replace(/^https?:\/\//, '').split('/')[0] ?? value;
    }
  } else {
    value = value.split('/')[0] ?? value;
  }

  value = value.replace(/:\d+$/, '');
  if (value.startsWith('www.')) {
    value = value.slice(4);
  }

  return value;
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Prefer domain property, then https URL matching project domain. */
export function pickBestGscProperty(
  siteUrls: string[],
  projectDomain: string,
): string | null {
  const host = normalizeDomainHost(projectDomain);
  if (!host || siteUrls.length === 0) return null;

  const domainProperty = `sc-domain:${host}`;
  const exactDomain = siteUrls.find(
    (url) => url.toLowerCase() === domainProperty,
  );
  if (exactDomain) return exactDomain;

  const urlMatches = siteUrls.filter((url) => {
    if (url.toLowerCase().startsWith('sc-domain:')) return false;
    return normalizeDomainHost(url) === host;
  });

  if (urlMatches.length === 0) return null;

  const httpsMatch = urlMatches.find((url) =>
    url.toLowerCase().startsWith('https://'),
  );
  return httpsMatch ?? urlMatches[0] ?? null;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** GSC data usually lags ~2–3 days; end at yesterday-2 for safer completeness. */
export function defaultGscEndDate(now = new Date()): string {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() - 3);
  return formatDateOnly(end);
}

export function defaultGscStartDate(endDate: string, days = 28): string {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return formatDateOnly(start);
}
