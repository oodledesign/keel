import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

const BATCH_SIZE = 20;

export type AccountDeletionCompletionResult = {
  due: number;
  completed: number;
  failed: number;
  errors: string[];
};

/**
 * Wipe data for deletions whose grace period has ended. Each user runs in one
 * database transaction, so a failure leaves their data untouched and the row
 * is retried on the next run.
 */
export async function runAccountDeletionCompletionCron(
  admin: SupabaseClient,
  now = new Date(),
): Promise<AccountDeletionCompletionResult> {
  const logger = await getLogger();
  const result: AccountDeletionCompletionResult = {
    due: 0,
    completed: 0,
    failed: 0,
    errors: [],
  };

  const { data, error } = await admin
    .from('account_deletions')
    .select('id, user_id')
    .in('status', ['scheduled', 'failed'])
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const rows = (data ?? []) as Array<{ id: string; user_id: string }>;
  result.due = rows.length;

  for (const row of rows) {
    const ctx = {
      name: 'account-deletion-completion',
      deletionId: row.id,
      userId: row.user_id,
    };

    const { data: affected, error: completeError } = await admin.rpc(
      'complete_account_deletion',
      { target_deletion_id: row.id },
    );

    if (completeError) {
      result.failed += 1;
      result.errors.push(`${row.user_id}: ${completeError.message}`);
      logger.error(
        { ...ctx, error: completeError },
        'Account deletion failed; data left untouched',
      );

      await admin
        .from('account_deletions')
        .update({ status: 'failed', error: completeError.message })
        .eq('id', row.id);

      continue;
    }

    result.completed += 1;
    logger.info(
      { ...ctx, rowsAffected: affected },
      'Account deletion completed',
    );
  }

  return result;
}
