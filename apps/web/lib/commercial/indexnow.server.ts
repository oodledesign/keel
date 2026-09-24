import 'server-only';

import { after } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isWebsiteFeedIncluded } from '~/lib/commercial/each-feed-inclusion';
import {
  INDEXNOW_KEY_META_KEY,
  type IndexNowState,
  buildIndexNowPlan,
  generateIndexNowKey,
  indexNowStateAfterAttempt,
  isValidIndexNowKey,
  parseIndexNowState,
  postIndexNowSubmission,
} from '~/lib/commercial/indexnow';
import { LISTING_URL_TEMPLATE_META_KEY } from '~/lib/commercial/listing-website-url';

const ON_MARKET = new Set(['marketing', 'under_offer']);

function db(): SupabaseClient {
  return getSupabaseServerClient() as unknown as SupabaseClient;
}

async function logIndexNowFailure(
  listingId: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  const logger = await getLogger();
  logger.error(
    {
      name: 'commercial.indexnow',
      listingId,
      error: error instanceof Error ? error.message : String(error),
      ...extra,
    },
    'IndexNow submission failed',
  );
}

/**
 * Run after the response when possible so a slow or failed IndexNow call
 * cannot block marketing or publish.
 */
export function scheduleIndexNowForListing(input: {
  accountId: string;
  listingId: string;
}): void {
  const run = () =>
    maybeNotifyIndexNowForListing(input).catch((error: unknown) => {
      void logIndexNowFailure(input.listingId, error);
    });

  try {
    after(() => run());
  } catch {
    void run();
  }
}

export async function clearListingIndexNowSubmission(input: {
  accountId: string;
  listingId: string;
}): Promise<void> {
  try {
    const { error } = await db()
      .from('commercial_listings')
      .update({ indexnow_state: {} })
      .eq('id', input.listingId)
      .eq('account_id', input.accountId);
    if (error) {
      await logIndexNowFailure(input.listingId, error.message);
    }
  } catch (error) {
    await logIndexNowFailure(input.listingId, error);
  }
}

type ListingIndexNowRow = {
  website_url: string | null;
  status: string;
  indexnow_state: unknown;
};

async function loadListingIndexNowRow(
  accountId: string,
  listingId: string,
): Promise<ListingIndexNowRow | null> {
  const { data, error } = await db()
    .from('commercial_listings')
    .select('website_url, status, indexnow_state')
    .eq('id', listingId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ListingIndexNowRow | null) ?? null;
}

async function loadWebsiteIndexNowContext(accountId: string): Promise<{
  key: string | null;
  listingUrlTemplate: string | null;
  siteUrl: string | null;
  websiteFeedIncludedFor: (listingId: string) => Promise<boolean>;
}> {
  const client = db();
  const { data, error } = await client
    .from('commercial_portal_credentials')
    .select('metadata, site_url')
    .eq('account_id', accountId)
    .eq('portal', 'property_hive')
    .maybeSingle();
  if (error) throw new Error(error.message);

  const metadata = (data?.metadata ?? {}) as Record<string, unknown>;
  const rawKey = metadata[INDEXNOW_KEY_META_KEY];
  const key =
    typeof rawKey === 'string' && isValidIndexNowKey(rawKey)
      ? rawKey.trim()
      : null;
  const template = metadata[LISTING_URL_TEMPLATE_META_KEY];
  const listingUrlTemplate =
    typeof template === 'string' && template.trim() ? template.trim() : null;
  const siteUrl =
    typeof data?.site_url === 'string' && data.site_url.trim()
      ? data.site_url.trim()
      : null;

  return {
    key,
    listingUrlTemplate,
    siteUrl,
    websiteFeedIncludedFor: async (listingId: string) => {
      const { data: publication, error: publicationError } = await client
        .from('commercial_portal_publications')
        .select('status')
        .eq('account_id', accountId)
        .eq('listing_id', listingId)
        .eq('portal', 'property_hive')
        .maybeSingle();
      if (publicationError) throw new Error(publicationError.message);
      return isWebsiteFeedIncluded(
        publication
          ? [{ portal: 'property_hive', status: String(publication.status) }]
          : [],
      );
    },
  };
}

async function saveIndexNowState(input: {
  accountId: string;
  listingId: string;
  state: IndexNowState;
}): Promise<void> {
  const { error } = await db()
    .from('commercial_listings')
    .update({ indexnow_state: input.state })
    .eq('id', input.listingId)
    .eq('account_id', input.accountId);
  if (error) throw new Error(error.message);
}

/**
 * Submit the listing's public website URL to IndexNow when Website is live.
 * Never throws — callers can fire this from publish paths safely.
 */
export async function maybeNotifyIndexNowForListing(input: {
  accountId: string;
  listingId: string;
}): Promise<void> {
  try {
    const listing = await loadListingIndexNowRow(
      input.accountId,
      input.listingId,
    );
    if (!listing) return;

    const context = await loadWebsiteIndexNowContext(input.accountId);
    const websiteFeedIncluded = await context.websiteFeedIncludedFor(
      input.listingId,
    );
    const plan = buildIndexNowPlan({
      websiteUrl: listing.website_url,
      onMarket: ON_MARKET.has(listing.status),
      websiteFeedIncluded,
      key: context.key,
      listingUrlTemplate: context.listingUrlTemplate,
      siteUrl: context.siteUrl,
      state: parseIndexNowState(listing.indexnow_state),
    });

    if (plan.action === 'skip') {
      const websiteUrl = listing.website_url?.trim() ?? '';
      const worthLogging =
        (plan.reason === 'no_host' && Boolean(context.key)) ||
        (plan.reason === 'url_not_eligible' &&
          Boolean(websiteUrl) &&
          isValidIndexNowKey(context.key));
      if (worthLogging) {
        const logger = await getLogger();
        logger.info(
          {
            name: 'commercial.indexnow',
            listingId: input.listingId,
            reason: plan.reason,
          },
          'IndexNow skipped',
        );
      }
      return;
    }

    const at = new Date();
    let ok = false;
    let status = 0;
    try {
      const result = await postIndexNowSubmission(plan.submission);
      ok = result.ok;
      status = result.status;
      if (!ok) {
        await logIndexNowFailure(input.listingId, `IndexNow HTTP ${status}`, {
          status,
          body: result.body,
        });
      }
    } catch (error) {
      await logIndexNowFailure(input.listingId, error);
    }

    await saveIndexNowState({
      accountId: input.accountId,
      listingId: input.listingId,
      state: indexNowStateAfterAttempt({
        previous: parseIndexNowState(listing.indexnow_state),
        url: plan.url,
        ok,
        at,
      }),
    });
  } catch (error) {
    await logIndexNowFailure(input.listingId, error);
  }
}

/**
 * Create or rotate the workspace IndexNow key on Website (Property Hive)
 * portal credentials. The key is an ownership proof the client hosts publicly.
 */
export async function upsertWebsiteIndexNowKey(input: {
  accountId: string;
  rotate?: boolean;
}): Promise<{ key: string; created: boolean }> {
  const client = db();
  const { data: existing, error: loadError } = await client
    .from('commercial_portal_credentials')
    .select('id, metadata')
    .eq('account_id', input.accountId)
    .eq('portal', 'property_hive')
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);

  const metadata = {
    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
  };
  const current = metadata[INDEXNOW_KEY_META_KEY];
  if (
    !input.rotate &&
    typeof current === 'string' &&
    isValidIndexNowKey(current)
  ) {
    return { key: current.trim(), created: false };
  }

  const key = generateIndexNowKey();
  metadata[INDEXNOW_KEY_META_KEY] = key;
  const now = new Date().toISOString();

  if (existing?.id) {
    const { error } = await client
      .from('commercial_portal_credentials')
      .update({ metadata, updated_at: now })
      .eq('id', existing.id as string);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client
      .from('commercial_portal_credentials')
      .insert({
        account_id: input.accountId,
        portal: 'property_hive',
        metadata,
        updated_at: now,
      });
    if (error) throw new Error(error.message);
  }

  return { key, created: true };
}
