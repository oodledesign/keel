import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  LISTING_URL_TEMPLATE_META_KEY,
  type ListingWebsiteUrlFields,
  isPublicListingPageUrl,
} from '~/lib/commercial/listing-website-url';
import { isWebsitePublicPageBroken } from '~/lib/commercial/listing-website-url-health';
import { getCachedWebsiteUrlHealth } from '~/lib/commercial/listing-website-url-health.server';
import {
  lookupWordpressListingPageUrl,
  resolvePublicWebsiteSiteOrigin,
} from '~/lib/commercial/listing-website-url-resolve';

function db(): SupabaseClient {
  return getSupabaseServerClient() as unknown as SupabaseClient;
}

export async function loadWebsiteListingUrlTemplate(
  accountId: string,
): Promise<string | null> {
  const { data } = await db()
    .from('commercial_portal_credentials')
    .select('metadata')
    .eq('account_id', accountId)
    .eq('portal', 'property_hive')
    .maybeSingle();
  const meta = (data?.metadata ?? {}) as Record<string, unknown>;
  const template = meta[LISTING_URL_TEMPLATE_META_KEY];
  return typeof template === 'string' && template.trim()
    ? template.trim()
    : null;
}

export async function loadPropertyHivePublicSiteUrl(
  accountId: string,
): Promise<string | null> {
  const { data } = await db()
    .from('commercial_portal_credentials')
    .select('site_url')
    .eq('account_id', accountId)
    .eq('portal', 'property_hive')
    .maybeSingle();
  const siteUrl = (data?.site_url as string | null | undefined)?.trim() ?? '';
  return siteUrl || null;
}

async function persistListingWebsiteUrl(input: {
  accountId: string;
  listingId: string;
  websiteUrl: string;
}): Promise<void> {
  const { error } = await db()
    .from('commercial_listings')
    .update({
      website_url: input.websiteUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.listingId)
    .eq('account_id', input.accountId);

  if (error) {
    console.error(
      '[website-url] persist failed',
      error.message,
      input.listingId,
    );
  }
}

export async function resolveLiveWordpressListingUrl(input: {
  accountId: string;
  listing: ListingWebsiteUrlFields;
  listingUrlTemplate?: string | null;
}): Promise<string | null> {
  const template =
    input.listingUrlTemplate ??
    (await loadWebsiteListingUrlTemplate(input.accountId));
  const propertyHiveSiteUrl = await loadPropertyHivePublicSiteUrl(
    input.accountId,
  );
  const origin = resolvePublicWebsiteSiteOrigin({
    listingUrlTemplate: template,
    propertyHiveSiteUrl,
  });
  if (!origin) return null;
  const { lookup } = await import('node:dns/promises');
  return lookupWordpressListingPageUrl({
    siteOrigin: origin,
    listing: input.listing,
    deps: {
      resolveHost: async (hostname) => {
        const results = await lookup(hostname, { all: true, verbatim: true });
        return results.map((entry) => entry.address);
      },
    },
  });
}

export async function loadWebsiteChannelUrlState(input: {
  accountId: string;
  listingId: string;
  listing: ListingWebsiteUrlFields & { websiteUrl?: string | null };
  publications: Array<{ portal: string; externalUrl?: string | null }>;
  listingUrlTemplate?: string | null;
  websiteIsLive: boolean;
}): Promise<{
  publicPageUrl: string | null;
  health: Awaited<ReturnType<typeof getCachedWebsiteUrlHealth>> | null;
}> {
  const template =
    input.listingUrlTemplate ??
    (await loadWebsiteListingUrlTemplate(input.accountId));
  const phPublication = input.publications.find(
    (publication) => publication.portal === 'property_hive',
  );
  const stored = input.listing.websiteUrl?.trim() ?? '';
  const portal = phPublication?.externalUrl?.trim() ?? '';
  let publicPageUrl =
    stored && isPublicListingPageUrl(stored)
      ? stored
      : portal && isPublicListingPageUrl(portal)
        ? portal
        : null;

  if (!input.websiteIsLive) {
    return { publicPageUrl, health: null };
  }

  if (publicPageUrl) {
    let health = await getCachedWebsiteUrlHealth(publicPageUrl);
    if (isWebsitePublicPageBroken(health)) {
      const resolved = await resolveLiveWordpressListingUrl({
        accountId: input.accountId,
        listing: input.listing,
        listingUrlTemplate: template,
      });
      if (resolved && resolved !== publicPageUrl) {
        await persistListingWebsiteUrl({
          accountId: input.accountId,
          listingId: input.listingId,
          websiteUrl: resolved,
        });
        publicPageUrl = resolved;
        health = await getCachedWebsiteUrlHealth(resolved);
      }
    }
    return { publicPageUrl, health };
  }

  const resolved = await resolveLiveWordpressListingUrl({
    accountId: input.accountId,
    listing: input.listing,
    listingUrlTemplate: template,
  });
  if (resolved) {
    await persistListingWebsiteUrl({
      accountId: input.accountId,
      listingId: input.listingId,
      websiteUrl: resolved,
    });
    return {
      publicPageUrl: resolved,
      health: await getCachedWebsiteUrlHealth(resolved),
    };
  }

  return { publicPageUrl: null, health: null };
}
