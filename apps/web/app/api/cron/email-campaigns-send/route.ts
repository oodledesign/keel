import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  createCampaignsService,
  processDueCampaignSends,
} from '~/lib/campaigns/campaigns.service';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 300;

const CAMPAIGN_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Starts due scheduled campaigns and continues in-flight sends. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaignId')?.trim() ?? '';
  const accountId = url.searchParams.get('accountId')?.trim() ?? '';
  const continuation = campaignId.length > 0 || accountId.length > 0;

  if (
    continuation &&
    (!CAMPAIGN_ID.test(campaignId) || !CAMPAIGN_ID.test(accountId))
  ) {
    return jsonErr('BAD_REQUEST', 'Invalid campaign continuation', 400);
  }

  try {
    const admin = getSupabaseServerAdminClient();
    if (continuation) {
      const result = await createCampaignsService(admin).processPending({
        accountId,
        campaignId,
      });
      return jsonOk({
        continued: result.lockAcquired,
        remaining: result.remaining,
        status: result.campaign.status,
      });
    }

    const result = await processDueCampaignSends(admin);
    return jsonOk(result);
  } catch (error) {
    console.error('[campaigns] scheduled send cron', error);
    return jsonErr(
      'CRON_FAILED',
      error instanceof Error ? error.message : 'Campaign send cron failed',
      500,
    );
  }
}
