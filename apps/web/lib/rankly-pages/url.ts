export function normalizeProjectPageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    }

    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url.trim();
  }
}

/** Stable lookup key for merging crawl + PageSpeed rows. */
export function pageUrlKey(url: string): string {
  try {
    const parsed = new URL(normalizeProjectPageUrl(url));
    const path = parsed.pathname === '/' ? '/' : parsed.pathname;
    return `${parsed.hostname}${path}${parsed.search}`;
  } catch {
    return url.toLowerCase().trim();
  }
}

export function pageKeyFromUrl(url: string): string {
  return Buffer.from(pageUrlKey(url), 'utf8').toString('base64url');
}

export function urlFromPageKey(pageKey: string): string | null {
  try {
    const key = Buffer.from(pageKey, 'base64url').toString('utf8');
    if (!key) return null;

    const slash = key.indexOf('/');
    if (slash === -1) return `https://${key}`;

    const host = key.slice(0, slash);
    const rest = key.slice(slash);
    return normalizeProjectPageUrl(`https://${host}${rest}`);
  } catch {
    return null;
  }
}

export function pageDisplayPath(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    return path === '/' ? '/' : path;
  } catch {
    return url;
  }
}
