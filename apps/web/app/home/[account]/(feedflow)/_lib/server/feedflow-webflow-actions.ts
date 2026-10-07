'use server';

import { revalidatePath } from 'next/cache';

import { randomUUID } from 'crypto';

import { enhanceAction } from '@kit/next/actions';

import pathsConfig from '~/config/paths.config';
import { assertFeedflowWriteAccess } from '~/lib/feedflow/assert-feedflow-write';
import { decryptSecret } from '~/lib/feedflow/crypto-tokens';
import { parseReviewDate, parseReviewsCsv } from '~/lib/feedflow/reviews-csv';
import { saveWebflowConnectionToken } from '~/lib/feedflow/webflow/connection';
import {
  deleteWebflowItem,
  getWebflowCollectionFields,
  listWebflowCollections,
  listWebflowSites,
} from '~/lib/feedflow/webflow/client';
import {
  missingRequiredFields,
  sanitizeFieldMapping,
  suggestFieldMapping,
} from '~/lib/feedflow/webflow/mapping';
import { syncWebflowConnection } from '~/lib/feedflow/webflow/sync';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import {
  addManualReviewActionSchema,
  connectWebflowActionSchema,
  deleteReviewActionSchema,
  importReviewsCsvActionSchema,
  loadWebflowTargetsActionSchema,
  saveWebflowSettingsActionSchema,
  saveWebflowTargetActionSchema,
  setReviewHiddenActionSchema,
  webflowConnectionActionSchema,
} from '../schema/feedflow-module.schema';

function reviewsPath(slug: string) {
  return pathsConfig.app.accountFeedflowReviews.replace('[account]', slug);
}

/** Loads a connection the caller's workspace owns, with its decrypted token. */
async function loadOwnedConnection(
  client: unknown,
  accountId: string,
  connectionId: string,
) {
  const { data, error } = await supabaseCustomSchema(client, 'feedflow')
    .from('webflow_connections')
    .select('id, webflow_api_token, webflow_site_id, webflow_collection_id, auto_publish')
    .eq('id', connectionId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) throw new Error('Webflow connection not found');
  return {
    id: data.id as string,
    siteId: (data.webflow_site_id as string | null) ?? null,
    collectionId: (data.webflow_collection_id as string | null) ?? null,
    autoPublish: Boolean(data.auto_publish),
    token: decryptSecret(data.webflow_api_token as string),
  };
}

export const connectWebflow = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertFeedflowWriteAccess(
      input.accountId,
      user.id,
    );

    const result = await saveWebflowConnectionToken(client, {
      accountId: input.accountId,
      clientId: input.clientId ?? null,
      token: input.token,
    });
    revalidatePath(reviewsPath(slug));
    return result;
  },
  { schema: connectWebflowActionSchema },
);

export const loadWebflowTargets = enhanceAction(
  async (input, user) => {
    const { client } = await assertFeedflowWriteAccess(
      input.accountId,
      user.id,
    );
    const connection = await loadOwnedConnection(
      client,
      input.accountId,
      input.connectionId,
    );

    const sites = await listWebflowSites(connection.token);
    const siteId = input.siteId ?? connection.siteId;
    if (siteId && !sites.some((site) => site.id === siteId)) {
      throw new Error('That Webflow site is not available to this token');
    }
    const collections = siteId
      ? await listWebflowCollections(connection.token, siteId)
      : [];
    return { sites, collections };
  },
  { schema: loadWebflowTargetsActionSchema },
);

export const saveWebflowTarget = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertFeedflowWriteAccess(
      input.accountId,
      user.id,
    );
    const connection = await loadOwnedConnection(
      client,
      input.accountId,
      input.connectionId,
    );

    const sites = await listWebflowSites(connection.token);
    const site = sites.find((candidate) => candidate.id === input.siteId);
    if (!site) throw new Error('That Webflow site is not available');
    const collections = await listWebflowCollections(
      connection.token,
      site.id,
    );
    const collection = collections.find(
      (candidate) => candidate.id === input.collectionId,
    );
    if (!collection) throw new Error('That collection is not on this site');

    const fields = await getWebflowCollectionFields(
      connection.token,
      collection.id,
    );
    const mapping = suggestFieldMapping(fields);

    // Switching collection invalidates item ids we hold for the old one.
    const feed = supabaseCustomSchema(client, 'feedflow');
    if (connection.collectionId && connection.collectionId !== collection.id) {
      // Remove our items from the old collection first so none are stranded.
      const { data: stale } = await feed
        .from('webflow_review_items')
        .select('webflow_item_id')
        .eq('webflow_connection_id', connection.id);
      for (const row of (stale ?? []) as Array<{ webflow_item_id: string }>) {
        await deleteWebflowItem(
          connection.token,
          connection.collectionId,
          row.webflow_item_id,
          { live: connection.autoPublish },
        ).catch(() => false);
      }
      await feed
        .from('webflow_review_items')
        .delete()
        .eq('webflow_connection_id', connection.id);
    }

    const { error } = await feed
      .from('webflow_connections')
      .update({
        webflow_site_id: site.id,
        site_name: site.displayName,
        webflow_collection_id: collection.id,
        collection_name: collection.displayName,
        field_mapping: mapping,
        sync_error: null,
      })
      .eq('id', connection.id)
      .eq('account_id', input.accountId);
    if (error) throw new Error(error.message);

    revalidatePath(reviewsPath(slug));
    return { fields, mapping };
  },
  { schema: saveWebflowTargetActionSchema },
);

export const loadWebflowFields = enhanceAction(
  async (input, user) => {
    const { client } = await assertFeedflowWriteAccess(
      input.accountId,
      user.id,
    );
    const connection = await loadOwnedConnection(
      client,
      input.accountId,
      input.connectionId,
    );
    if (!connection.collectionId) return { fields: [] };
    return {
      fields: await getWebflowCollectionFields(
        connection.token,
        connection.collectionId,
      ),
    };
  },
  { schema: webflowConnectionActionSchema },
);

export const saveWebflowSettings = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertFeedflowWriteAccess(
      input.accountId,
      user.id,
    );
    const connection = await loadOwnedConnection(
      client,
      input.accountId,
      input.connectionId,
    );
    if (!connection.collectionId) {
      throw new Error('Choose a collection first');
    }

    const fields = await getWebflowCollectionFields(
      connection.token,
      connection.collectionId,
    );
    const mapping = sanitizeFieldMapping(input.mapping, fields);
    const missing = missingRequiredFields(mapping, fields);
    if (missing.length > 0) {
      throw new Error(
        `Map the required Webflow fields: ${missing.map((f) => f.displayName).join(', ')}`,
      );
    }

    const { error } = await supabaseCustomSchema(client, 'feedflow')
      .from('webflow_connections')
      .update({
        field_mapping: mapping,
        sync_mode: input.syncMode,
        auto_publish: input.autoPublish,
        min_rating: input.minRating,
        min_character_count: input.minCharacterCount,
      })
      .eq('id', connection.id)
      .eq('account_id', input.accountId);
    if (error) throw new Error(error.message);

    revalidatePath(reviewsPath(slug));
    return { ok: true as const };
  },
  { schema: saveWebflowSettingsActionSchema },
);

export const syncWebflowNow = enhanceAction(
  async (input, user) => {
    const { slug } = await assertFeedflowWriteAccess(input.accountId, user.id);
    try {
      return await syncWebflowConnection(input.connectionId, input.accountId);
    } finally {
      revalidatePath(reviewsPath(slug));
    }
  },
  { schema: webflowConnectionActionSchema },
);

export const disconnectWebflow = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertFeedflowWriteAccess(
      input.accountId,
      user.id,
    );
    const { error } = await supabaseCustomSchema(client, 'feedflow')
      .from('webflow_connections')
      .delete()
      .eq('id', input.connectionId)
      .eq('account_id', input.accountId);
    if (error) throw new Error(error.message);
    revalidatePath(reviewsPath(slug));
    return { ok: true as const };
  },
  { schema: webflowConnectionActionSchema },
);

export const addManualReview = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertFeedflowWriteAccess(
      input.accountId,
      user.id,
    );
    const { error } = await supabaseCustomSchema(client, 'feedflow')
      .from('reviews')
      .insert({
        account_id: input.accountId,
        client_id: input.clientId ?? null,
        source: 'manual',
        external_id: randomUUID(),
        reviewer_name: input.reviewerName,
        rating: input.rating,
        comment: input.comment || null,
        reviewed_at: input.reviewedAt
          ? parseReviewDate(input.reviewedAt)
          : new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    revalidatePath(reviewsPath(slug));
    return { ok: true as const };
  },
  { schema: addManualReviewActionSchema },
);

export const importReviewsCsv = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertFeedflowWriteAccess(
      input.accountId,
      user.id,
    );
    const parsed = parseReviewsCsv(input.csv);
    if (parsed.reviews.length === 0) {
      throw new Error(
        parsed.errors[0]?.message ?? 'No valid reviews found in this CSV',
      );
    }

    // Upsert on the content-derived id; never overwrite `hidden`.
    const { error } = await supabaseCustomSchema(client, 'feedflow')
      .from('reviews')
      .upsert(
        parsed.reviews.map((review) => ({
          account_id: input.accountId,
          client_id: input.clientId ?? null,
          source: 'csv',
          external_id: review.externalId,
          reviewer_name: review.reviewerName,
          rating: review.rating,
          comment: review.comment,
          reviewed_at: review.reviewedAt,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'account_id,source,external_id' },
      );
    if (error) throw new Error(error.message);

    revalidatePath(reviewsPath(slug));
    return { imported: parsed.reviews.length, errors: parsed.errors };
  },
  { schema: importReviewsCsvActionSchema },
);

export const setReviewHidden = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertFeedflowWriteAccess(
      input.accountId,
      user.id,
    );
    const { error } = await supabaseCustomSchema(client, 'feedflow')
      .from('reviews')
      .update({ hidden: input.hidden, updated_at: new Date().toISOString() })
      .eq('id', input.reviewId)
      .eq('account_id', input.accountId);
    if (error) throw new Error(error.message);
    revalidatePath(reviewsPath(slug));
    return { ok: true as const };
  },
  { schema: setReviewHiddenActionSchema },
);

export const deleteReview = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertFeedflowWriteAccess(
      input.accountId,
      user.id,
    );
    const { error } = await supabaseCustomSchema(client, 'feedflow')
      .from('reviews')
      .delete()
      .eq('id', input.reviewId)
      .eq('account_id', input.accountId);
    if (error) throw new Error(error.message);
    revalidatePath(reviewsPath(slug));
    return { ok: true as const };
  },
  { schema: deleteReviewActionSchema },
);
