import { authorizeCron } from '~/lib/email-assistant/cron-auth';
import { createFeedflowAdminClient } from '~/lib/feedflow/admin';
import { InstagramRateLimitedError } from '~/lib/feedflow/instagram';
import { ingestInstagramAccount } from '~/lib/feedflow/posts';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Refresh persisted Instagram posts so public embeds never hit Graph. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const admin = createFeedflowAdminClient();
  const { data: accounts, error } = await admin
    .from('social_accounts')
    .select('id, token_status, provider, platform')
    .or('provider.eq.instagram,platform.eq.instagram');

  if (error) {
    return jsonErr('LOAD_FAILED', error.message, 500);
  }

  let ingested = 0;
  let failed = 0;
  let rateLimited = false;
  let stored = 0;

  for (const row of accounts ?? []) {
    if ((row as { token_status?: string }).token_status === 'needs_reauth') {
      continue;
    }

    try {
      const result = await ingestInstagramAccount(row.id as string);
      ingested += 1;
      stored += result.stored;
      if (result.rateLimited) {
        rateLimited = true;
        break;
      }
    } catch (error) {
      if (error instanceof InstagramRateLimitedError) {
        rateLimited = true;
        break;
      }
      failed += 1;
      console.error('[feedflow] media ingest', row.id, error);
    }
  }

  return jsonOk({
    scanned: accounts?.length ?? 0,
    ingested,
    failed,
    stored,
    rateLimited,
  });
}
