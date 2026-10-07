import 'server-only';

import { createFeedflowAdminClient } from '~/lib/feedflow/admin';
import { decryptSecret } from '~/lib/feedflow/crypto-tokens';

import {
  WebflowApiError,
  createWebflowItem,
  deleteWebflowItem,
  getWebflowCollectionFields,
  publishWebflowItems,
  updateWebflowItem,
} from './client';
import { fieldDataHash } from './field-hash';
import {
  type ReviewFieldMapping,
  type SyncableReview,
  buildReviewFieldData,
  missingRequiredFields,
  sanitizeFieldMapping,
  shouldSyncReview,
} from './mapping';

/** Cap writes per run so one connection cannot exhaust a cron invocation. */
const MAX_WRITES_PER_RUN = 120;
/** A crashed run must not block syncing forever. */
const REVIEW_FETCH_LIMIT = 5000;
const STALE_LOCK_MS = 10 * 60 * 1000;

type ConnectionRow = {
  id: string;
  account_id: string;
  client_id: string | null;
  webflow_collection_id: string | null;
  webflow_api_token: string;
  sync_mode: string | null;
  auto_publish: boolean | null;
  min_character_count: number | null;
  min_rating: number | null;
  field_mapping: unknown;
};

type ItemRow = {
  id: string;
  review_id: string | null;
  webflow_item_id: string;
  content_hash: string;
};

export type WebflowSyncResult = {
  fetched: number;
  created: number;
  updated: number;
  removed: number;
  skipped: number;
  partial: boolean;
};

export async function syncWebflowConnection(
  connectionId: string,
  expectedAccountId?: string,
): Promise<WebflowSyncResult> {
  const feed = createFeedflowAdminClient();

  const { data: connection, error: loadError } = await feed
    .from('webflow_connections')
    .select(
      'id, account_id, client_id, webflow_collection_id, webflow_api_token, sync_mode, auto_publish, min_character_count, min_rating, field_mapping',
    )
    .eq('id', connectionId)
    .maybeSingle();

  const conn = connection as ConnectionRow | null;
  if (loadError || !conn) throw new Error('Webflow connection not found');
  if (expectedAccountId && conn.account_id !== expectedAccountId) {
    throw new Error('Webflow connection not found');
  }
  if (!conn.webflow_collection_id) {
    throw new Error('Choose a Webflow collection before syncing');
  }
  const collectionId = conn.webflow_collection_id;

  // Atomically claim the run so a cron tick and "Sync now" cannot overlap.
  const { data: claimed } = await feed
    .from('webflow_connections')
    .update({
      sync_status: 'syncing',
      sync_error: null,
      sync_started_at: new Date().toISOString(),
    })
    .eq('id', conn.id)
    .or(
      `sync_status.is.null,sync_status.neq.syncing,sync_started_at.lt.${new Date(Date.now() - STALE_LOCK_MS).toISOString()}`,
    )
    .select('id');
  if (!claimed || claimed.length === 0) {
    throw new Error('A sync is already running for this connection');
  }

  const result: WebflowSyncResult = {
    fetched: 0,
    created: 0,
    updated: 0,
    removed: 0,
    skipped: 0,
    partial: false,
  };

  try {
    const token = decryptSecret(conn.webflow_api_token);
    const fields = await getWebflowCollectionFields(token, collectionId);
    const mapping: ReviewFieldMapping = sanitizeFieldMapping(
      conn.field_mapping,
      fields,
    );
    const missing = missingRequiredFields(mapping, fields);
    if (missing.length > 0) {
      throw new Error(
        `Map the required Webflow fields first: ${missing.map((f) => f.displayName).join(', ')}`,
      );
    }

    let reviewQuery = feed
      .from('reviews')
      .select(
        'id, reviewer_name, reviewer_photo_url, rating, comment, reply, reviewed_at, hidden',
      )
      .eq('account_id', conn.account_id)
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .limit(REVIEW_FETCH_LIMIT);
    reviewQuery = conn.client_id
      ? reviewQuery.eq('client_id', conn.client_id)
      : reviewQuery.is('client_id', null);
    const { data: reviewRows, error: reviewError } = await reviewQuery;
    if (reviewError) throw new Error(reviewError.message);
    const reviews = (reviewRows ?? []) as SyncableReview[];
    result.fetched = reviews.length;
    // A truncated list would make older, still-wanted items look orphaned.
    const truncated = reviews.length >= REVIEW_FETCH_LIMIT;
    if (truncated) result.partial = true;

    const { data: itemRows, error: itemError } = await feed
      .from('webflow_review_items')
      .select('id, review_id, webflow_item_id, content_hash')
      .eq('webflow_connection_id', conn.id);
    if (itemError) throw new Error(itemError.message);
    const allItems = (itemRows ?? []) as ItemRow[];
    const items = new Map<string, ItemRow>();
    const orphans: ItemRow[] = [];
    for (const row of allItems) {
      if (row.review_id) items.set(row.review_id, row);
      else orphans.push(row);
    }

    const settings = {
      syncMode: conn.sync_mode === 'with_text' ? 'with_text' : 'all',
      minRating: conn.min_rating ?? 1,
      minCharacterCount: conn.min_character_count ?? 0,
    } as const;

    const wanted = new Set<string>();
    const toPublish: string[] = [];
    let writes = 0;

    for (const review of reviews) {
      if (!shouldSyncReview(review, settings)) {
        result.skipped += 1;
        continue;
      }
      wanted.add(review.id);

      const fieldData = buildReviewFieldData(review, mapping, fields);
      const hash = fieldDataHash(fieldData);
      const existing = items.get(review.id);
      if (existing && existing.content_hash === hash) continue;

      if (writes >= MAX_WRITES_PER_RUN) {
        result.partial = true;
        continue;
      }
      writes += 1;

      if (existing) {
        await updateWebflowItem(
          token,
          collectionId,
          existing.webflow_item_id,
          fieldData,
        );
        await feed
          .from('webflow_review_items')
          .update({ content_hash: hash, synced_at: new Date().toISOString() })
          .eq('id', existing.id);
        toPublish.push(existing.webflow_item_id);
        result.updated += 1;
      } else {
        const itemId = await createWebflowItem(token, collectionId, fieldData);
        const { error: insertError } = await feed
          .from('webflow_review_items')
          .insert({
            account_id: conn.account_id,
            webflow_connection_id: conn.id,
            review_id: review.id,
            webflow_item_id: itemId,
            content_hash: hash,
          });
        if (insertError) {
          // Do not leave an orphan we can no longer track.
          await deleteWebflowItem(token, collectionId, itemId).catch(
            () => false,
          );
          throw new Error(insertError.message);
        }
        toPublish.push(itemId);
        result.created += 1;
      }
    }

    // Reviews that were hidden, filtered out or deleted leave Webflow too.
    const removals: ItemRow[] = truncated
      ? orphans
      : [
          ...orphans,
          ...[...items].filter(([id]) => !wanted.has(id)).map(([, row]) => row),
        ];
    for (const row of removals) {
      if (writes >= MAX_WRITES_PER_RUN) {
        result.partial = true;
        break;
      }
      writes += 1;
      await deleteWebflowItem(token, collectionId, row.webflow_item_id, {
        live: Boolean(conn.auto_publish),
      });
      await feed.from('webflow_review_items').delete().eq('id', row.id);
      result.removed += 1;
    }

    if (conn.auto_publish && toPublish.length > 0) {
      await publishWebflowItems(token, collectionId, toPublish);
    }

    await feed
      .from('webflow_connections')
      .update({
        sync_status: result.partial ? 'partial' : 'idle',
        sync_error: null,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', conn.id);

    await feed.from('webflow_sync_log').insert({
      account_id: conn.account_id,
      webflow_connection_id: conn.id,
      reviews_fetched: result.fetched,
      reviews_synced: result.created + result.updated,
      reviews_skipped: result.skipped,
      success: true,
    });

    return result;
  } catch (error) {
    const message =
      error instanceof WebflowApiError || error instanceof Error
        ? error.message
        : 'Sync failed';
    await feed
      .from('webflow_connections')
      .update({ sync_status: 'error', sync_error: message })
      .eq('id', conn.id);
    await feed.from('webflow_sync_log').insert({
      account_id: conn.account_id,
      webflow_connection_id: conn.id,
      reviews_fetched: result.fetched,
      reviews_synced: result.created + result.updated,
      reviews_skipped: result.skipped,
      success: false,
      error_message: message,
    });
    throw error;
  }
}
