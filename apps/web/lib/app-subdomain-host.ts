import {
  getAppSiteOrigin,
  getMarketingSiteOrigin,
  isAppMarketingHostSplitEnabled,
} from '~/lib/app-host-routing';

/** Reserved on ozer.so — hosts the authenticated Ozer app, not agency portals. */
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

/** Static assets required for PWA install — must not redirect to /app on app host. */
const APP_HOST_STATIC_PATHS = [
  '/manifest.webmanifest',
  '/sw.js',
  '/favicon.ico',
  '/robots.txt',
] as const;

export function isAppHostStaticPath(pathname: string): boolean {
  if (APP_HOST_STATIC_PATHS.includes(pathname as (typeof APP_HOST_STATIC_PATHS)[number])) {
    return true;
  }

  return (
    pathname.startsWith('/brand/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/locales/')
  );
}

/** OAuth / MCP discovery and consent — must stay on app.ozer.so without redirecting to /app. */
export function isAppHostOAuthPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/.well-known/') || pathname.startsWith('/oauth/')
  );
}

const MARKETING_ROUTE_PREFIXES = [
  '/personal',
  '/work',
  '/property',
  '/community',
  '/apps',
  '/features',
  '/pricing',
  '/faq',
  '/contact',
  '/blog',
  '/docs',
  '/changelog',
  '/privacy-policy',
  '/terms-of-service',
  '/cookie-policy',
  '/trust',
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

/** True when the request hostname is the reserved app subdomain (e.g. app.ozer.so). */
export function isAppSubdomainHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);

  // Local dev serves marketing and app from the same origin — never treat as app-only host.
  if (normalized === 'localhost' || normalized === '127.0.0.1') {
    return false;
  }

  if (normalized.startsWith(`${APP_SUBDOMAIN}.`)) {
    return !normalized.includes('localhost');
  }

  const appHost = hostFromOrigin(getAppSiteOrigin());

  return Boolean(appHost && normalized === appHost);
}

/**
 * When marketing and app use different hostnames, return a redirect target URL
 * or null if the request should continue unchanged.
 */
export function resolveAppSubdomainRedirect(url: URL): string | null {
  const hostname = normalizeHostname(url.hostname);
  const onAppHost = isAppSubdomainHostname(hostname);
  const splitEnabled = shouldSplitAppAndMarketingHosts() || onAppHost;

  if (!splitEnabled) {
    return null;
  }

  const appOrigin = getAppSiteOrigin();
  const appHost = hostFromOrigin(appOrigin);
  const marketingHosts = getMarketingHostnames();
  const { pathname, search } = url;

  if (onAppHost) {
    if (
      isAppRoute(pathname) ||
      isAppHostStaticPath(pathname) ||
      isAppHostOAuthPublicPath(pathname)
    ) {
      return null;
    }

    if (isMarketingRoute(pathname) && pathname !== '/') {
      return `${getMarketingSiteOrigin()}${pathname}${search}`;
    }

    const dashboard = new URL('/app', url);
    dashboard.search = search;
    return dashboard.toString();
  }

  if (appHost && marketingHosts.has(hostname) && isAppRoute(pathname)) {
    return `${appOrigin}${pathname}${search}`;
  }

  return null;
}
