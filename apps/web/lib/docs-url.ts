/**
 * Public product documentation (Nextra app).
 * Local: http://localhost:3012 — production: https://docs.ozer.so
 */
export function getDocsSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_DOCS_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3012';
  }

  return 'https://docs.ozer.so';
}

/** Absolute URL on the docs site (path may be empty or start with `/`). */
export function docsUrl(path = '/'): string {
  const origin = getDocsSiteOrigin();
  if (!path || path === '/') {
    return origin;
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalized}`;
}
