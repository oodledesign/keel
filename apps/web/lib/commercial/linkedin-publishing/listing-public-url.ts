import pathsConfig from '~/config/paths.config';

export type ListingPublicUrlSource = 'website' | 'portal' | 'brochure';

export type ListingPublicUrlResult = {
  url: string | null;
  source: ListingPublicUrlSource | null;
  label: string | null;
};

export type ListingPublicUrlInput = {
  websiteUrl?: string | null;
  brochureShareEnabled?: boolean;
  brochureShareToken?: string | null;
  publications?: Array<{
    portal: string;
    status: string;
    externalUrl: string | null;
  }>;
  /** Absolute origin of the Ozer app (e.g. https://app.ozer.so). */
  appOrigin: string;
};

const LIVE_PORTAL_STATUSES = new Set(['published', 'live', 'synced']);

const PORTAL_PRIORITY = ['property_hive', 'each', 'rightmove'] as const;

export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function portalLabel(portal: string): string {
  if (portal === 'property_hive') return 'Property Hive';
  if (portal === 'each') return 'EACH';
  if (portal === 'rightmove') return 'Rightmove';
  return portal.replace(/_/g, ' ');
}

function livePortalUrl(
  publications: ListingPublicUrlInput['publications'],
): { url: string; portal: string } | null {
  const live = (publications ?? []).filter(
    (row) =>
      LIVE_PORTAL_STATUSES.has(row.status) &&
      row.externalUrl &&
      isSafeHttpUrl(row.externalUrl),
  );
  if (live.length === 0) return null;

  for (const portal of PORTAL_PRIORITY) {
    const match = live.find((row) => row.portal === portal);
    if (match?.externalUrl) {
      return { url: match.externalUrl.trim(), portal };
    }
  }

  const first = live[0]!;
  return { url: first.externalUrl!.trim(), portal: first.portal };
}

/**
 * Resolve a real public listing URL. Never invents a domain.
 *
 * Priority:
 * 1. Listing website URL (WordPress / Property Hive / agency site)
 * 2. Live portal publication URL (Property Hive, EACH, Rightmove)
 * 3. Ozer brochure share (`/share/brochure/:token`) when enabled
 */
export function resolveListingPublicUrl(
  input: ListingPublicUrlInput,
): ListingPublicUrlResult {
  const website = input.websiteUrl?.trim() ?? '';
  if (website && isSafeHttpUrl(website)) {
    return { url: website, source: 'website', label: 'Website listing' };
  }

  const portal = livePortalUrl(input.publications);
  if (portal) {
    return {
      url: portal.url,
      source: 'portal',
      label: `${portalLabel(portal.portal)} listing`,
    };
  }

  const token = input.brochureShareToken?.trim() ?? '';
  const origin = input.appOrigin.replace(/\/+$/, '');
  if (input.brochureShareEnabled && token && origin && isSafeHttpUrl(origin)) {
    const path = pathsConfig.app.brochureShare.replace('[token]', token);
    return {
      url: `${origin}${path}`,
      source: 'brochure',
      label: 'Ozer brochure share',
    };
  }

  return { url: null, source: null, label: null };
}

export function linkedInPermalinkFromUrn(
  urn: string | null | undefined,
): string | null {
  if (!urn?.trim()) return null;
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn.trim())}`;
}
