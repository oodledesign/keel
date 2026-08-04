import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { estimateJobCost } from '~/lib/billing/media-unit-pricing';
import {
  debitMediaCredits,
  isInsufficientMediaCreditsError,
} from '~/lib/media-credits/ledger';
import { minimaxVideoRecipe } from '~/lib/media-generation/models/minimax-video';
import {
  falQueueResult,
  falQueueStatus,
} from '~/lib/media-generation/providers/fal';
import { persistRemoteMediaToStorage } from '~/lib/media-generation/storage';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

export const runtime = 'nodejs';
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

const MAX_JOB_AGE_MS = 1000 * 60 * 45;

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonErr('UNAUTHORIZED', 'Invalid cron secret', 401);
  }

  const logger = await getLogger();
  const admin = getSupabaseServerAdminClient();
  const { data: jobs, error } = await admin
    .from('media_generation_jobs')
    .select('*')
    .eq('status', 'processing')
    .eq('type', 'video')
    .not('external_job_id', 'is', null)
    .limit(25);

  if (error) {
    return jsonErr('INTERNAL_ERROR', error.message, 500);
  }

  let completed = 0;
  let failed = 0;
  let pending = 0;

  for (const raw of jobs ?? []) {
    const job = raw as {
      id: string;
      account_id: string;
      model_id: string;
      external_job_id: string;
      prompt: string | null;
      params: { durationSeconds?: number } | null;
      created_at: string;
    };

    const age = Date.now() - new Date(job.created_at).getTime();
    if (age > MAX_JOB_AGE_MS) {
      await admin
        .from('media_generation_jobs')
        .update({
          status: 'failed',
          error_message: 'Timed out waiting for provider',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      failed += 1;
      continue;
    }

    try {
      const status = await falQueueStatus(
        job.model_id || minimaxVideoRecipe.modelId,
        job.external_job_id,
      );

      if (status.status === 'IN_QUEUE' || status.status === 'IN_PROGRESS') {
        pending += 1;
        continue;
      }

      if (status.status === 'FAILED' || status.status === 'CANCELLED') {
        await admin
          .from('media_generation_jobs')
          .update({
            status: 'failed',
            error_message: `Provider status: ${status.status}`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        failed += 1;
        continue;
      }

      const result = await falQueueResult<{ video?: { url: string } }>(
        job.model_id || minimaxVideoRecipe.modelId,
        job.external_job_id,
      );
      const remoteUrl = minimaxVideoRecipe.extractOutputUrl(result);
      if (!remoteUrl) {
        await admin
          .from('media_generation_jobs')
          .update({
            status: 'failed',
            error_message: 'No video URL in provider result',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        failed += 1;
        continue;
      }

      const stored = await persistRemoteMediaToStorage({
        accountId: job.account_id,
        remoteUrl,
        pathSuffix: `results/${job.id}.mp4`,
        contentTypeHint: 'video/mp4',
      });

      const durationSeconds =
        job.params?.durationSeconds ??
        minimaxVideoRecipe.defaultDurationSeconds;
      const units = estimateJobCost(minimaxVideoRecipe.modelId, {
        durationSeconds,
      });

      let charged = units;
      let debitError: string | null = null;
      try {
        await debitMediaCredits(job.account_id, units, job.id);
      } catch (err) {
        // Keep the asset: account already incurred provider cost.
        charged = 0;
        debitError = isInsufficientMediaCreditsError(err)
          ? err.message
          : err instanceof Error
            ? err.message
            : 'debit_failed';
        logger.warn(
          {
            name: 'media.video.debit_shortfall',
            jobId: job.id,
            accountId: job.account_id,
            units,
            debitError,
          },
          'Video complete but media debit failed — asset retained',
        );
      }

      await admin
        .from('media_generation_jobs')
        .update({
          status: 'complete',
          file_url: stored.signedUrl,
          thumbnail_url: stored.signedUrl,
          media_credits_charged: charged,
          provider_cost_usd:
            minimaxVideoRecipe.providerCostUsdPerSecondEstimate *
            durationSeconds,
          error_message: debitError
            ? `Completed with debit shortfall: ${debitError}`
            : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      completed += 1;
    } catch (err) {
      logger.error(
        {
          name: 'media.video.poll',
          jobId: job.id,
          error: err instanceof Error ? err.message : String(err),
        },
        'Video poll failed',
      );
      pending += 1;
    }
  }

  return jsonOk({ completed, failed, pending, scanned: jobs?.length ?? 0 });
}
