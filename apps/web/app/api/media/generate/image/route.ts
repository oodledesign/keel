import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  estimateImageBatchCost,
  estimateJobCost,
  resolveImageModelId,
  type ImageQualityTier,
} from '~/lib/billing/media-unit-pricing';
import {
  debitMediaCredits,
  getMediaBalance,
  isInsufficientMediaCreditsError,
} from '~/lib/media-credits/ledger';
import { resolveImageRecipe } from '~/lib/media-generation/models/image-router';
import { isMediaGenerateEnabled } from '~/lib/media-generation/module-access';
import { FalProviderError, falRun } from '~/lib/media-generation/providers/fal';
import {
  persistRemoteMediaToStorage,
  uploadMediaGenerationFile,
} from '~/lib/media-generation/storage';
import { userIsAccountMember } from '~/lib/rankly/account-membership';

export const runtime = 'nodejs';
export const maxDuration = 300;

const bodySchema = z.object({
  accountId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(4000),
  projectId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  quality: z.enum(['draft', 'quality']).default('draft'),
  variations: z.number().int().min(1).max(4).default(1),
  /** Base64 data URL or raw base64 for an optional reference image. */
  refImageBase64: z.string().optional().nullable(),
  refImageContentType: z.string().optional().nullable(),
  /** Promote a completed draft to quality (reuses seed when available). */
  promoteFromJobId: z.string().uuid().optional().nullable(),
  seed: z.number().int().optional().nullable(),
});

type JobRow = Record<string, unknown> & { id: string };

function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

export const POST = enhanceRouteHandler(
  async ({ request, user }) => {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      accountId,
      projectId,
      clientId,
      refImageBase64,
      refImageContentType,
      promoteFromJobId,
    } = parsed.data;

    let prompt = parsed.data.prompt;
    let quality: ImageQualityTier = parsed.data.quality;
    let variations = parsed.data.variations;
    let seedOverride = parsed.data.seed ?? null;

    const client = getSupabaseServerClient();
    const isMember =
      accountId === user.id ||
      (await userIsAccountMember(client, user.id, accountId));

    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const enabled = await isMediaGenerateEnabled(accountId);
    if (!enabled) {
      return NextResponse.json(
        {
          error:
            'Media generation is disabled for this workspace. Enable it in settings.',
        },
        { status: 403 },
      );
    }

    const admin = getSupabaseServerAdminClient();
    let resolvedClientId = clientId ?? null;
    let refImageUrls: string[] = [];
    let promotedFromJobId: string | null = null;

    if (promoteFromJobId) {
      const { data: source, error: sourceError } = await admin
        .from('media_generation_jobs')
        .select('*')
        .eq('id', promoteFromJobId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (sourceError || !source) {
        return NextResponse.json(
          { error: 'Draft job not found' },
          { status: 404 },
        );
      }

      if ((source as { status?: string }).status !== 'complete') {
        return NextResponse.json(
          { error: 'Only completed draft jobs can be promoted' },
          { status: 400 },
        );
      }

      if ((source as { type?: string }).type !== 'image') {
        return NextResponse.json(
          { error: 'Only image jobs can be promoted' },
          { status: 400 },
        );
      }

      const sourceParams = (source as { params?: Record<string, unknown> })
        .params;
      const sourceQuality = sourceParams?.quality;
      if (sourceQuality === 'quality') {
        return NextResponse.json(
          { error: 'This job is already quality tier' },
          { status: 400 },
        );
      }

      prompt =
        String((source as { prompt?: string | null }).prompt ?? '').trim() ||
        prompt;
      quality = 'quality';
      variations = 1;
      promotedFromJobId = (source as { id: string }).id;

      const refs = (source as { refs?: unknown }).refs;
      if (Array.isArray(refs)) {
        refImageUrls = refs
          .map((entry) =>
            entry && typeof entry === 'object' && 'url' in entry
              ? String((entry as { url: unknown }).url)
              : null,
          )
          .filter((url): url is string => Boolean(url));
      }

      const sourceSeed = sourceParams?.seed;
      if (typeof sourceSeed === 'number') {
        seedOverride = sourceSeed;
      }

      if (!resolvedClientId) {
        resolvedClientId =
          (source as { client_id?: string | null }).client_id ?? null;
      }
    }

    if (projectId && !resolvedClientId) {
      const { data: project } = await admin
        .from('projects')
        .select('client_id')
        .eq('id', projectId)
        .eq('account_id', accountId)
        .maybeSingle();
      resolvedClientId =
        (project as { client_id?: string | null } | null)?.client_id ?? null;
    }

    if (!promoteFromJobId && refImageBase64) {
      const raw = refImageBase64.includes(',')
        ? refImageBase64.split(',')[1]!
        : refImageBase64;
      const bytes = Buffer.from(raw, 'base64');
      const contentType = refImageContentType ?? 'image/png';
      const uploaded = await uploadMediaGenerationFile({
        accountId,
        pathSuffix: `refs/${crypto.randomUUID()}`,
        bytes,
        contentType,
      });
      refImageUrls = [uploaded.signedUrl];
    }

    const hasRefs = refImageUrls.length > 0;
    const modelId = resolveImageModelId(hasRefs, quality);
    const unitsPerImage = estimateJobCost(modelId);
    const totalEstimate = estimateImageBatchCost({
      hasRefs,
      quality,
      variations,
    });

    const balance = await getMediaBalance(accountId);
    if (balance < totalEstimate) {
      return NextResponse.json(
        {
          error: `Insufficient media credits (have ${balance}, need ${totalEstimate})`,
          balance,
          required: totalEstimate,
          code: 'INSUFFICIENT_MEDIA_CREDITS',
        },
        { status: 402 },
      );
    }

    const recipe = resolveImageRecipe({ hasRefs, quality });
    const completed: JobRow[] = [];
    const failed: JobRow[] = [];
    let chargedTotal = 0;

    for (let i = 0; i < variations; i++) {
      const seed = seedOverride ?? randomSeed();
      // For multi-variation without promote, use distinct seeds.
      const variationSeed =
        promoteFromJobId || variations === 1 ? seed : randomSeed();

      const { data: job, error: insertError } = await admin
        .from('media_generation_jobs')
        .insert({
          account_id: accountId,
          project_id: projectId ?? null,
          client_id: resolvedClientId,
          created_by: user.id,
          provider: 'fal',
          model_id: recipe.modelId,
          type: 'image',
          status: 'processing',
          prompt,
          refs: refImageUrls.map((url) => ({ url })),
          params: {
            quality,
            seed: variationSeed,
            variationIndex: i,
            variationCount: variations,
          },
          media_credits_charged: 0,
          promoted_from_job_id: promotedFromJobId,
        })
        .select('*')
        .single();

      if (insertError || !job) {
        failed.push({
          id: crypto.randomUUID(),
          status: 'failed',
          error_message: insertError?.message ?? 'Failed to create job',
        } as JobRow);
        continue;
      }

      const jobId = (job as { id: string }).id;

      try {
        const input = recipe.buildInput({
          prompt,
          refImageUrls,
          seed: variationSeed,
        });
        const response = await falRun<unknown>(recipe.modelId, input);
        const remoteUrl = recipe.extractOutputUrl(response);
        if (!remoteUrl) {
          throw new FalProviderError(502, 'No image URL in fal response');
        }

        const stored = await persistRemoteMediaToStorage({
          accountId,
          remoteUrl,
          pathSuffix: `results/${jobId}.png`,
          contentTypeHint: 'image/png',
        });

        const responseSeed = recipe.extractSeed(response) ?? variationSeed;

        // Debit only after a successful generation (partial batch billing).
        try {
          await debitMediaCredits(accountId, unitsPerImage, jobId);
          chargedTotal += unitsPerImage;
        } catch (debitError) {
          if (isInsufficientMediaCreditsError(debitError)) {
            const { data: kept } = await admin
              .from('media_generation_jobs')
              .update({
                status: 'complete',
                file_url: stored.signedUrl,
                thumbnail_url: stored.signedUrl,
                provider_cost_usd: recipe.providerCostUsdEstimate,
                media_credits_charged: 0,
                params: {
                  quality,
                  seed: responseSeed,
                  variationIndex: i,
                  variationCount: variations,
                  debitShortfall: true,
                },
                completed_at: new Date().toISOString(),
                error_message: `Generated but debit failed: ${debitError.message}`,
              })
              .eq('id', jobId)
              .select('*')
              .single();

            if (kept) completed.push(kept as JobRow);
            failed.push({
              id: jobId,
              status: 'failed',
              error_message: debitError.message,
            } as JobRow);
            break;
          }
          throw debitError;
        }

        const { data: updated, error: updateError } = await admin
          .from('media_generation_jobs')
          .update({
            status: 'complete',
            file_url: stored.signedUrl,
            thumbnail_url: stored.signedUrl,
            provider_cost_usd: recipe.providerCostUsdEstimate,
            media_credits_charged: unitsPerImage,
            params: {
              quality,
              seed: responseSeed,
              variationIndex: i,
              variationCount: variations,
            },
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId)
          .select('*')
          .single();

        if (updateError || !updated) {
          throw new Error(updateError?.message ?? 'Failed to update job');
        }

        completed.push(updated as JobRow);
      } catch (error) {
        const message =
          error instanceof FalProviderError
            ? `Provider error (${error.status})`
            : error instanceof Error
              ? error.message
              : 'Generation failed';

        const { data: failedJob } = await admin
          .from('media_generation_jobs')
          .update({
            status: 'failed',
            error_message: message,
            completed_at: new Date().toISOString(),
            media_credits_charged: 0,
          })
          .eq('id', jobId)
          .select('*')
          .single();

        if (failedJob) failed.push(failedJob as JobRow);
        else
          failed.push({
            id: jobId,
            status: 'failed',
            error_message: message,
          } as JobRow);
      }
    }

    if (completed.length === 0) {
      return NextResponse.json(
        {
          error: failed[0]?.error_message ?? 'All variations failed',
          jobs: failed,
          completed: [],
          failed,
          chargedTotal,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      job: completed[0],
      jobs: [...completed, ...failed],
      completed,
      failed,
      chargedTotal,
      unitsPerImage,
      modelId: recipe.modelId,
    });
  },
  { auth: true },
);
