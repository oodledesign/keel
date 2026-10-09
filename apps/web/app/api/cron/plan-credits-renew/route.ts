import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { renewAdminPlanGrants } from '~/lib/billing/renew-admin-plan-grants';
import { expireStaleCampaignCreditBatches } from '~/lib/campaign-credits/ledger';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** Hourly: sweep expired campaign batches, then renew admin-applied plans. */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const expiredCampaignBatches = await expireStaleCampaignCreditBatches().catch(
    (err: unknown) => {
      console.error('[cron/plan-credits-renew] expiry sweep failed', err);
      return null;
    },
  );

  try {
    const renewals = await renewAdminPlanGrants(getSupabaseServerAdminClient());

    const failed = [...renewals.campaigns.failed, ...renewals.media.failed];
    if (failed.length > 0) {
      console.error('[cron/plan-credits-renew] renewal failures', failed);
    }

    return jsonOk({ expiredCampaignBatches, renewals });
  } catch (err) {
    return jsonErr(
      'INTERNAL_ERROR',
      err instanceof Error ? err.message : 'Plan credit renewal failed',
      500,
    );
  }
}
