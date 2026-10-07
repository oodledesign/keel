import { authorizeCron } from '~/lib/email-assistant/cron-auth';
import { createFeedflowAdminClient } from '~/lib/feedflow/admin';
import { syncWebflowConnection } from '~/lib/feedflow/webflow/sync';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Push Feedflow reviews to every configured Webflow CMS collection. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const { data, error } = await createFeedflowAdminClient()
    .from('webflow_connections')
    .select('id')
    .not('webflow_collection_id', 'is', null);

  if (error) {
    return jsonErr('LOAD_FAILED', error.message, 500);
  }

  const deadline = Date.now() + (maxDuration - 30) * 1000;
  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of (data ?? []) as Array<{ id: string }>) {
    if (Date.now() > deadline) break;
    try {
      await syncWebflowConnection(row.id);
      synced += 1;
    } catch (err) {
      // Already recorded on the connection and in webflow_sync_log.
      if (
        err instanceof Error &&
        err.message.includes('already running')
      ) {
        skipped += 1;
      } else {
        failed += 1;
      }
    }
  }

  return jsonOk({ synced, failed, skipped });
}
