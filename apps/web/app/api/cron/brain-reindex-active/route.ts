import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { indexAccount, listActiveAccountIds } from '~/lib/brain/indexer';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Nightly: re-index accounts with content changes in the last 24 hours. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = getSupabaseServerAdminClient();
  const accountIds = await listActiveAccountIds(admin);
  let indexed = 0;
  const errors: string[] = [];

  for (const accountId of accountIds) {
    try {
      await indexAccount(admin, accountId);
      indexed += 1;
    } catch (err) {
      errors.push(
        `${accountId}: ${err instanceof Error ? err.message : 'failed'}`,
      );
    }
  }

  return jsonOk({ accounts: accountIds.length, indexed, errors });
}
