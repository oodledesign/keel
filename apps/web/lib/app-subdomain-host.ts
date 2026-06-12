import {
  buildAppSiteUrl,
  getAppSiteOrigin,
  getMarketingSiteOrigin,
  isAppMarketingHostSplitEnabled,
} from '~/lib/app-host-routing';

/** Reserved on keelos.so — hosts the authenticated Keel app, not agency portals. */
export const APP_SUBDOMAIN = 'app';

const APP_ROUTE_PREFIXES = [
  '/auth',
  '/app',
  '/home',
  '/admin',
  '/onboarding',
  '/setup',
  '/identities',
  '/update-password',
  '/join',
  '/portal',
  '/watch',
] as const;

const MARKETING_ROUTE_PREFIXES = [
  '/personal',
  '/work',
  '/property',
  '/community',
  '/apps',
  '/pricing',
  '/faq',
  '/contact',
  '/blog',
  '/docs',
  '/changelog',
  '/privacy-policy',
  '/terms-of-service',
  '/cookie-policy',
] as const;

export function normalizeHostname(hostname: string): string {
  return hostname.split(':')[0]?.toLowerCase() ?? '';
}

export function hostFromOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function getMarketingHostnames(): Set<string> {
  const marketingHost = hostFromOrigin(getMarketingSiteOrigin());

  if (!marketingHost) {
    return new Set();
  }

  const hosts = new Set<string>([marketingHost]);

  if (marketingHost.startsWith('www.')) {
    hosts.add(marketingHost.slice(4));
  } else {
    hosts.add(`www.${marketingHost}`);
  }

  return hosts;
}

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isMarketingRoute(pathname: string): boolean {
  if (pathname === '/') {
    return true;
  }

  return MARKETING_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function shouldSplitAppAndMarketingHosts(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_APP_SUBDOMAIN_ROUTING === 'false') {
    return false;
  }

  return isAppMarketingHostSplitEnabled();
}

/**
 * When marketing and app use different hostnames, return a redirect target URL
 * or null if the request should continue unchanged.
 */
export function resolveAppSubdomainRedirect(url: URL): string | null {
  if (!shouldSplitAppAndMarketingHosts()) {
    return null;
  }

  const hostname = normalizeHostname(url.hostname);
  const appHost = hostFromOrigin(getAppSiteOrigin());
  const marketingHosts = getMarketingHostnames();

  if (!appHost) {
    return null;
  }

  const { pathname, search } = url;

  if (marketingHosts.has(hostname)) {
    if (!isAppRoute(pathname)) {
      return null;
    }

    return `${getAppSiteOrigin()}${pathname}${search}`;
  }

  if (hostname === appHost) {
    if (pathname === '/') {
      return buildAppSiteUrl('/app');
    }

    if (isMarketingRoute(pathname)) {
      return `${getMarketingSiteOrigin()}${pathname}${search}`;
    }
  }

  return null;
}
