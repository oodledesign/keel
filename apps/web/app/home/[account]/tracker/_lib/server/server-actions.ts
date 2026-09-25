'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  createCompetitorTrackerService,
  enrichCompetitorFromUrl,
  parseCompetitorCsv,
  processCompetitorAreaWatches,
} from '~/lib/commercial/competitor-tracker';

import {
  ArchiveTrackerListingSchema,
  CreateTrackerListingSchema,
  CreateTrackerWatchSchema,
  DeleteTrackerWatchSchema,
  EnrichTrackerUrlSchema,
  ImportTrackerCsvSchema,
  ListTrackerSchema,
  MarkTrackerNotificationsReadSchema,
  RunTrackerWatchesSchema,
  SaveEnrichedTrackerListingSchema,
  UpdateTrackerListingSchema,
  UpdateTrackerWatchSchema,
} from '../schema/tracker.schema';

function getService() {
  return createCompetitorTrackerService(getSupabaseServerClient());
}

function revalidateTracker() {
  revalidatePath('/home/[account]/tracker', 'page');
}

function normalizeSourceUrl(url: string | null | undefined) {
  const trimmed = url?.trim() || null;
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('Source URL must start with http:// or https://');
  }
  return trimmed;
}

async function assertAccountMember(accountId: string) {
  const client = getSupabaseServerClient();
  const { data, error } = await client.rpc('has_role_on_account', {
    account_id: accountId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Unauthorized');
}

export const listTrackerListings = enhanceAction(
  async (input) =>
    getService().listListings(input.accountId, {
      category: input.category,
      status: input.status,
      query: input.query,
    }),
  { schema: ListTrackerSchema },
);

export const createTrackerListing = enhanceAction(
  async (input, user) => {
    const listing = await getService().createListing({
      ...input,
      sourceUrl: normalizeSourceUrl(input.sourceUrl),
      createdBy: user.id,
    });
    revalidateTracker();
    return listing;
  },
  { schema: CreateTrackerListingSchema },
);

export const updateTrackerListing = enhanceAction(
  async (input) => {
    const listing = await getService().updateListing({
      ...input,
      sourceUrl:
        input.sourceUrl !== undefined
          ? normalizeSourceUrl(input.sourceUrl)
          : undefined,
    });
    revalidateTracker();
    return listing;
  },
  { schema: UpdateTrackerListingSchema },
);

export const archiveTrackerListing = enhanceAction(
  async (input) => {
    await getService().archiveListing(input.listingId, input.accountId);
    revalidateTracker();
    return { success: true };
  },
  { schema: ArchiveTrackerListingSchema },
);

export const importTrackerCsv = enhanceAction(
  async (input, user) => {
    const rows = parseCompetitorCsv(input.csvText);
    if (rows.length === 0) {
      throw new Error('No rows found in CSV');
    }
    const result = await getService().importCsvRows(
      input.accountId,
      rows,
      user.id,
    );
    revalidateTracker();
    return result;
  },
  { schema: ImportTrackerCsvSchema },
);

export const enrichTrackerUrl = enhanceAction(
  async (input) => {
    await assertAccountMember(input.accountId);
    return enrichCompetitorFromUrl(input.url);
  },
  { schema: EnrichTrackerUrlSchema },
);

export const saveEnrichedTrackerListing = enhanceAction(
  async (input, user) => {
    const { enrichmentConfidence, ...listingInput } = input;
    const result = await getService().upsertBySourceUrl({
      ...listingInput,
      sourceUrl: normalizeSourceUrl(listingInput.sourceUrl),
      createdBy: user.id,
      metadata: {
        enrich: 'url_paste',
        enrichedAt: new Date().toISOString(),
        ...(enrichmentConfidence ? { enrichmentConfidence } : {}),
      },
    });
    revalidateTracker();
    return result;
  },
  { schema: SaveEnrichedTrackerListingSchema },
);

export const listTrackerWatches = enhanceAction(
  async (input) => getService().listWatches(input.accountId),
  { schema: ListTrackerSchema.pick({ accountId: true }) },
);

export const createTrackerWatch = enhanceAction(
  async (input, user) => {
    const watch = await getService().createWatch({
      ...input,
      createdBy: user.id,
    });
    revalidateTracker();
    return watch;
  },
  { schema: CreateTrackerWatchSchema },
);

export const updateTrackerWatch = enhanceAction(
  async (input) => {
    const watch = await getService().updateWatch(input);
    revalidateTracker();
    return watch;
  },
  { schema: UpdateTrackerWatchSchema },
);

export const deleteTrackerWatch = enhanceAction(
  async (input) => {
    await getService().deleteWatch(input.watchId, input.accountId);
    revalidateTracker();
    return { success: true };
  },
  { schema: DeleteTrackerWatchSchema },
);

export const listTrackerNotifications = enhanceAction(
  async (input) => getService().listNotifications(input.accountId),
  { schema: ListTrackerSchema.pick({ accountId: true }) },
);

export const markTrackerNotificationsRead = enhanceAction(
  async (input) => {
    await getService().markNotificationsRead(
      input.accountId,
      input.notificationIds,
    );
    revalidateTracker();
    return { success: true };
  },
  { schema: MarkTrackerNotificationsReadSchema },
);

export const runTrackerWatchesNow = enhanceAction(
  async (input) => {
    await assertAccountMember(input.accountId);
    const admin = getSupabaseServerAdminClient();
    const result = await processCompetitorAreaWatches({
      client: admin,
      accountId: input.accountId,
      sinceHours: input.sinceHours ?? 24,
    });
    revalidateTracker();
    return result;
  },
  { schema: RunTrackerWatchesSchema },
);
