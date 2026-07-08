import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { syncFreeAgentToOzer } from '~/lib/integrations/freeagent/sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Accounts synced per cron tick — keeps each run within serverless limits. */
const MAX_ACCOUNTS_PER_RUN = 5;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();

  const { data: connections, error } = await admin
    .from('finance_connections')
    .select('id, account_id, last_sync_at')
    .eq('provider', 'freeagent')
    .order('last_sync_at', { ascending: true, nullsFirst: true })
    .limit(MAX_ACCOUNTS_PER_RUN);

  if (error) {
    return jsonErr('DB_ERROR', error.message, 500);
  }

  let synced = 0;
  let failed = 0;
  const errors: Array<{ accountId: string; message: string }> = [];

  for (const connection of connections ?? []) {
    const accountId = connection.account_id as string;
    try {
      await syncFreeAgentToOzer(admin, accountId, { mode: 'incremental' });
      synced++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : 'Sync failed';
      errors.push({ accountId, message });
      await admin
        .from('finance_connections')
        .update({
          sync_state: {
            lastMode: 'incremental',
            lastCronError: message,
            lastCronFailedAt: new Date().toISOString(),
          },
        })
        .eq('id', connection.id as string);
    }
  }

  return jsonOk({
    attempted: connections?.length ?? 0,
    synced,
    failed,
    errors,
  });
}
