import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  deleteAuthoredSourceChunks,
  deleteSourceChunks,
  indexAccount,
  indexSource,
} from './indexer';
import type { BrainSourceType } from './paths';

export function queueBrainIndexSource(
  accountId: string,
  sourceType: BrainSourceType,
  sourceId: string,
) {
  const admin = getSupabaseServerAdminClient();
  void indexSource(admin, accountId, sourceType, sourceId).catch((err) => {
    console.error('[brain] indexSource failed', {
      accountId,
      sourceType,
      sourceId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export function queueBrainDeleteSource(sourceId: string) {
  const admin = getSupabaseServerAdminClient();
  void deleteSourceChunks(admin, sourceId).catch((err) => {
    console.error('[brain] deleteSourceChunks failed', {
      sourceId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export function queueBrainDeleteAuthoredSources(userId: string) {
  const admin = getSupabaseServerAdminClient();
  void deleteAuthoredSourceChunks(admin, userId).catch((err) => {
    console.error('[brain] deleteAuthoredSourceChunks failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/** Re-index every workspace a user belongs to, after they allow AI processing again. */
export function queueBrainIndexUserAccounts(userId: string) {
  const admin = getSupabaseServerAdminClient();
  void (async () => {
    const { data, error } = await admin
      .from('accounts_memberships')
      .select('account_id')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);

    const accountIds = new Set([
      userId,
      ...(data ?? []).map((row) => row.account_id as string),
    ]);
    for (const accountId of accountIds) {
      await indexAccount(admin, accountId);
    }
  })().catch((err) => {
    console.error('[brain] queueBrainIndexUserAccounts failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export function queueBrainIndexAccount(accountId: string) {
  const admin = getSupabaseServerAdminClient();
  void indexAccount(admin, accountId).catch((err) => {
    console.error('[brain] indexAccount failed', {
      accountId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
