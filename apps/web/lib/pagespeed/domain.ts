import { normaliseOverviewDomain } from '~/lib/site-overview/domain';

export function projectDomainToHomepageUrl(domain: string): string {
  const trimmed = domain.trim();
  if (!trimmed) {
    throw new Error('Project domain is required');
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }

  return `https://${trimmed.replace(/^\/+/, '').replace(/\/+$/, '')}`;
}

export function normalizePagespeedUrl(
  input: string,
  projectDomain: string,
): string {
  const raw = input.trim();
  if (!raw) {
    throw new Error('URL is required');
  }

  const host = normaliseOverviewDomain(projectDomain);

  if (/^https?:\/\//i.test(raw)) {
    const parsed = new URL(raw);
    const pageHost = normaliseOverviewDomain(parsed.hostname);
    if (pageHost !== host) {
      throw new Error(`URL must belong to ${host}`);
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, '') + parsed.search;
  }

  if (raw.startsWith('/')) {
    return `https://${host}${raw}`;
  }

  return `https://${host}/${raw.replace(/^\/+/, '')}`;
}

export function pageLabelFromUrl(url: string, isHomepage: boolean): string {
  if (isHomepage) return 'Homepage';
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return path || parsed.hostname;
  } catch {
    return url;
  }
}
