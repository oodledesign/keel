import 'server-only';

import { headers } from 'next/headers';

import {
  AGENCY_PORTAL_REQUEST_HEADER,
  extractAgencyPortalSlug,
} from '~/lib/agency-portal-host';

function readRequestHostname(headerStore: Headers): string {
  return (
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    ''
  );
}

/** True when this request is the public agency portal for the given route slug. */
export async function isAgencyPortalRequest(routeSlug: string): Promise<boolean> {
  const requestHeaders = await headers();
  const normalizedRouteSlug = routeSlug.trim().toLowerCase();

  if (!normalizedRouteSlug) {
    return false;
  }

  if (requestHeaders.get(AGENCY_PORTAL_REQUEST_HEADER) === '1') {
    return true;
  }

  const hostSlug = extractAgencyPortalSlug(readRequestHostname(requestHeaders));

  return hostSlug !== null && hostSlug === normalizedRouteSlug;
}

export async function getAgencyPortalSlugFromRequest(): Promise<string | null> {
  const requestHeaders = await headers();

  if (requestHeaders.get(AGENCY_PORTAL_REQUEST_HEADER) === '1') {
    return extractAgencyPortalSlug(readRequestHostname(requestHeaders));
  }

  return extractAgencyPortalSlug(readRequestHostname(requestHeaders));
}
