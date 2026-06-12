/** Canonical app origin for auth, onboarding, and workspace routes. */
export function getAppSiteOrigin(): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_SITE_URL?.replace(/\/+$/, '') ??
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');

  if (appUrl) {
    return appUrl;
  }

  return 'http://localhost:3000';
}

const DEFAULT_MARKETING_SITE_ORIGIN = 'http://localhost:3000';

export function getMarketingSiteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.replace(/\/$/, '') ??
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ??
    DEFAULT_MARKETING_SITE_ORIGIN
  );
}

export function buildMarketingSiteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;

  return `${getMarketingSiteOrigin()}${normalized}`;
}

export function buildAppSiteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;

  return `${getAppSiteOrigin()}${normalized}`;
}
