const AGENCY_PORTAL_DOMAIN = 'ozer.so';

const IGNORED_SUBDOMAINS = new Set(['www', 'app', 'staging', 'localhost']);

/**
 * Extract an agency portal slug from the request hostname.
 * Returns null for the apex domain, ignored subdomains, and bare localhost.
 */
export function extractAgencyPortalSlug(hostname: string): string | null {
  const host = hostname.split(':')[0]?.toLowerCase() ?? '';

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  if (host.endsWith(`.${AGENCY_PORTAL_DOMAIN}`)) {
    const subdomain = host.slice(0, -(AGENCY_PORTAL_DOMAIN.length + 1));

    if (!subdomain || subdomain.includes('.')) {
      return null;
    }

    if (IGNORED_SUBDOMAINS.has(subdomain)) {
      return null;
    }

    return subdomain;
  }

  return null;
}

export function buildAgencyPortalRewritePath(
  slug: string,
  pathname: string,
): string {
  const portalPrefix = `/portal/${slug}`;

  if (pathname === portalPrefix || pathname.startsWith(`${portalPrefix}/`)) {
    return pathname;
  }

  if (pathname === '/') {
    return portalPrefix;
  }

  return `${portalPrefix}${pathname}`;
}

export const AGENCY_PORTAL_REQUEST_HEADER = 'x-agency-portal';
