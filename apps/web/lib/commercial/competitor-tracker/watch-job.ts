import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeCompetitorCategory } from './constants';
import {
  type CompetitorAreaWatch,
  type CompetitorCategory,
  type CompetitorListing,
  createCompetitorTrackerService,
} from './service';

function listingMatchesWatch(
  listing: CompetitorListing,
  watch: CompetitorAreaWatch,
): boolean {
  const watchCategories = watch.categories.map((c) =>
    normalizeCompetitorCategory(c),
  ) as CompetitorCategory[];
  if (!watchCategories.includes(listing.category)) return false;

  const size = listing.sizeSqft ?? listing.sizeMinSqft ?? listing.sizeMaxSqft;
  if (watch.sizeMinSqft != null && size != null && size < watch.sizeMinSqft) {
    return false;
  }
  if (watch.sizeMaxSqft != null && size != null && size > watch.sizeMaxSqft) {
    return false;
  }

  const towns = watch.towns.map((t) => t.trim().toLowerCase()).filter(Boolean);
  const prefixes = watch.postcodePrefixes
    .map((p) => p.trim().toUpperCase().replace(/\s+/g, ''))
    .filter(Boolean);

  if (towns.length === 0 && prefixes.length === 0) {
    return true;
  }

  const hay =
    `${listing.town ?? ''} ${listing.locationText ?? ''} ${listing.name}`.toLowerCase();
  const postcode = (listing.postcode ?? '').toUpperCase().replace(/\s+/g, '');

  const townHit =
    towns.length === 0 || towns.some((town) => hay.includes(town));
  const postcodeHit =
    prefixes.length === 0 ||
    prefixes.some((prefix) => postcode.startsWith(prefix));

  return townHit && postcodeHit;
}

function mapWatchRow(watchRow: Record<string, unknown>): CompetitorAreaWatch {
  return {
    id: String(watchRow.id),
    accountId: String(watchRow.account_id),
    name: String(watchRow.name),
    towns: (watchRow.towns as string[]) ?? [],
    postcodePrefixes: (watchRow.postcode_prefixes as string[]) ?? [],
    categories: ((watchRow.categories as string[]) ?? []).map((c) =>
      normalizeCompetitorCategory(c),
    ),
    sizeMinSqft: (watchRow.size_min_sqft as number | null) ?? null,
    sizeMaxSqft: (watchRow.size_max_sqft as number | null) ?? null,
    notifyOnNew: watchRow.notify_on_new !== false,
    notifyOnPriceChange: watchRow.notify_on_price_change !== false,
    enabled: true,
    lastRunAt: (watchRow.last_run_at as string | null) ?? null,
    createdAt: String(watchRow.created_at),
    updatedAt: String(watchRow.updated_at),
  };
}

/**
 * Match recently created/updated competitor listings to enabled watches and
 * create in-app notifications. Does not scrape Rightmove search pages.
 */
export async function processCompetitorAreaWatches(input: {
  client: SupabaseClient;
  accountId?: string;
  sinceHours?: number;
}): Promise<{
  watchesProcessed: number;
  notificationsCreated: number;
}> {
  const sinceHours = input.sinceHours ?? 24;
  const sinceIso = new Date(
    Date.now() - sinceHours * 60 * 60 * 1000,
  ).toISOString();

  let watchesQuery = input.client
    .from('competitor_area_watches')
    .select('*')
    .eq('enabled', true);

  if (input.accountId) {
    watchesQuery = watchesQuery.eq('account_id', input.accountId);
  }

  const { data: watchRows, error: watchError } = await watchesQuery;
  if (watchError) throw new Error(watchError.message);

  const watches = (watchRows ?? []).map((row) =>
    mapWatchRow(row as Record<string, unknown>),
  );

  const watchesByAccount = new Map<string, CompetitorAreaWatch[]>();
  for (const watch of watches) {
    const list = watchesByAccount.get(watch.accountId) ?? [];
    list.push(watch);
    watchesByAccount.set(watch.accountId, list);
  }

  let notificationsCreated = 0;
  const service = createCompetitorTrackerService(input.client);

  for (const [accountId, accountWatches] of watchesByAccount) {
    const listings = await service.listListings(accountId, {
      includeArchived: false,
    });

    for (const watch of accountWatches) {
      const candidates = listings.filter((listing) => {
        if (!listingMatchesWatch(listing, watch)) return false;
        const touched =
          listing.createdAt >= sinceIso ||
          listing.updatedAt >= sinceIso ||
          (listing.priceChangedAt != null &&
            listing.priceChangedAt >= sinceIso);
        return touched;
      });

      for (const listing of candidates) {
        const events: Array<'new' | 'price_changed'> = [];
        if (watch.notifyOnNew && listing.createdAt >= sinceIso) {
          events.push('new');
        }
        if (
          watch.notifyOnPriceChange &&
          listing.priceChangedAt &&
          listing.priceChangedAt >= sinceIso
        ) {
          events.push('price_changed');
        }

        for (const eventType of events) {
          const summary =
            eventType === 'new'
              ? `New competitor: ${listing.name}`
              : `Price changed: ${listing.name}`;

          const { error } = await input.client
            .from('competitor_watch_notifications')
            .upsert(
              {
                account_id: watch.accountId,
                watch_id: watch.id,
                listing_id: listing.id,
                event_type: eventType,
                summary,
              },
              {
                onConflict: 'watch_id,listing_id,event_type',
                ignoreDuplicates: true,
              },
            );

          if (!error) notificationsCreated += 1;
        }
      }

      await input.client
        .from('competitor_area_watches')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', watch.id)
        .eq('account_id', watch.accountId);
    }
  }

  return {
    watchesProcessed: watches.length,
    notificationsCreated,
  };
}
