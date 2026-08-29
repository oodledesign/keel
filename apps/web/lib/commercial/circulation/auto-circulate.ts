import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { circulateContactDigests } from '~/lib/commercial/circulation/circulate-digest';
import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';
import { ACTIVE_LISTING_STATUSES_FOR_MATCH } from '~/lib/commercial/match-scoring';

const MAX_ACCOUNTS = 80;

type AccountRow = { account_id: string };

async function loadCirculationAccountIds(
  admin: SupabaseClient,
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data, error } = await db
    .from('commercial_listings')
    .select('account_id')
    .eq('auto_circulate_matches', true)
    .in('status', [...ACTIVE_LISTING_STATUSES_FOR_MATCH])
    .limit(2000);

  if (error) {
    throw new Error(error.message);
  }

  return [
    ...new Set(
      ((data ?? []) as AccountRow[])
        .map((row) => row.account_id)
        .filter(Boolean),
    ),
  ].slice(0, MAX_ACCOUNTS);
}

export async function runCommercialAutoCirculation(
  admin: SupabaseClient,
  options?: { accountId?: string; triggerListingId?: string | null },
): Promise<{
  accounts: number;
  mailed: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl) {
    return {
      accounts: 0,
      mailed: 0,
      skipped: 0,
      failed: 0,
      errors: ['NEXT_PUBLIC_SITE_URL is not configured'],
    };
  }

  const accountIds = options?.accountId
    ? [options.accountId]
    : await loadCirculationAccountIds(admin);

  let mailed = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];
  const circulation = createCommercialCirculationService(admin);

  for (const accountId of accountIds) {
    try {
      const settings = await circulation.getOrCreateSettings(accountId);
      if (!settings.auto_send_enabled) {
        skipped += 1;
        continue;
      }

      const result = await circulateContactDigests(admin, {
        accountId,
        siteUrl,
        sentBy: null,
        sendTrigger: 'auto',
        autoEligibility: true,
        requireAutoCirculateListing: !options?.triggerListingId,
        triggerListingId: options?.triggerListingId ?? null,
      });
      mailed += result.mailed;
      skipped += result.skipped;
      failed += result.failed;
    } catch (err) {
      errors.push(
        `${accountId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    accounts: accountIds.length,
    mailed,
    skipped,
    failed,
    errors,
  };
}

export async function runCirculationForPublishedListing(
  admin: SupabaseClient,
  input: { accountId: string; listingId: string },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data: listing, error } = await db
    .from('commercial_listings')
    .select('id, status, auto_circulate_matches')
    .eq('id', input.listingId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (error || !listing) return;

  const status = String(listing.status ?? '');
  if (
    !(ACTIVE_LISTING_STATUSES_FOR_MATCH as readonly string[]).includes(status)
  ) {
    return;
  }
  if (!listing.auto_circulate_matches) return;

  await runCommercialAutoCirculation(admin, {
    accountId: input.accountId,
    triggerListingId: input.listingId,
  });
}
