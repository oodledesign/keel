function hostFromOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * When marketing uses www.{apex} but SITE_URL still points at www, infer app.{apex}
 * so middleware redirects can split hosts before env vars are fully updated.
 */
function inferAppOriginFromMarketing(
  siteUrl: string,
  marketingUrl: string,
): string | null {
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  const siteHost = hostFromOrigin(siteUrl);
  const marketingHost = hostFromOrigin(marketingUrl);

  if (!siteHost || !marketingHost || siteHost !== marketingHost) {
    return null;
  }

  if (!marketingHost.startsWith('www.')) {
    return null;
  }

  const apex = marketingHost.slice(4);

  if (!apex || apex.includes('localhost')) {
    return null;
  }

  try {
    const protocol = new URL(siteUrl).protocol;
    return `${protocol}//app.${apex}`;
  } catch {
    return null;
  }
}

function inferAppOriginFromWwwMarketing(marketingUrl: string): string | null {
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  const marketingHost = hostFromOrigin(marketingUrl);

  if (!marketingHost?.startsWith('www.')) {
    return null;
  }

  const apex = marketingHost.slice(4);

  if (!apex || apex.includes('localhost')) {
    return null;
  }

  try {
    const protocol = new URL(marketingUrl).protocol;
    return `${protocol}//app.${apex}`;
  } catch {
    return null;
  }
}

/** Canonical app origin for auth, onboarding, and workspace routes. */
export function getAppSiteOrigin(): string {
  const explicitApp = process.env.NEXT_PUBLIC_APP_SITE_URL?.replace(/\/+$/, '');

  if (explicitApp) {
    return explicitApp;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  const marketingUrl = getMarketingSiteOrigin();

  if (siteUrl) {
    const siteHost = hostFromOrigin(siteUrl);

    if (siteHost?.startsWith('app.')) {
      return siteUrl;
    }

    const inferredFromMarketing = inferAppOriginFromWwwMarketing(marketingUrl);

    if (inferredFromMarketing) {
      return inferredFromMarketing;
    }

    if (marketingUrl && siteUrl === marketingUrl) {
      const inferred = inferAppOriginFromMarketing(siteUrl, marketingUrl);

      if (inferred) {
        return inferred;
      }
    }

    return siteUrl;
  }

  return 'http://localhost:3000';
}

const DEFAULT_MARKETING_SITE_ORIGIN =
  process.env.NODE_ENV === 'production'
    ? 'https://www.ozer.so'
    : 'http://localhost:3000';

export function getMarketingSiteOrigin(): string {
  const explicitMarketing = process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.replace(
    /\/+$/,
    '',
  );

  if (explicitMarketing) {
    return explicitMarketing;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');

  if (siteUrl) {
    const siteHost = hostFromOrigin(siteUrl);

    if (siteHost?.startsWith('app.')) {
      return `https://www.${siteHost.slice(4)}`;
    }

    return siteUrl;
  }

  return DEFAULT_MARKETING_SITE_ORIGIN;
}

export function buildMarketingSiteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;

  return `${getMarketingSiteOrigin()}${normalized}`;
}

export function buildAppSiteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;

  return `${getAppSiteOrigin()}${normalized}`;
}

export function isAppMarketingHostSplitEnabled(): boolean {
  const appHost = hostFromOrigin(getAppSiteOrigin());
  const marketingHost = hostFromOrigin(getMarketingSiteOrigin());

  if (!appHost || !marketingHost) {
    return false;
  }

  return appHost !== marketingHost;
}
