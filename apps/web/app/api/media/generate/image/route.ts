import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { userIsAccountMember } from '~/lib/rankly/account-membership';
import {
  debitMediaCredits,
  isInsufficientMediaCreditsError,
  refundMediaCredits,
} from '~/lib/media-credits/ledger';
import { fluxSchnellRecipe } from '~/lib/media-generation/models/flux-schnell';
import { isMediaGenerateEnabled } from '~/lib/media-generation/module-access';
import { FalProviderError, falRun } from '~/lib/media-generation/providers/fal';
import {
  persistRemoteMediaToStorage,
  uploadMediaGenerationFile,
} from '~/lib/media-generation/storage';

export const runtime = 'nodejs';
export const maxDuration = 120;

const bodySchema = z.object({
  accountId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(4000),
  projectId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  /** Base64 data URL or raw base64 for an optional reference image. */
  refImageBase64: z.string().optional().nullable(),
  refImageContentType: z.string().optional().nullable(),
});

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
      prompt,
      projectId,
      clientId,
      refImageBase64,
      refImageContentType,
    } = parsed.data;

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

    let refImageUrl: string | null = null;
    if (refImageBase64) {
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
      refImageUrl = uploaded.signedUrl;
    }

    const units = fluxSchnellRecipe.unitsPerGeneration();
    const { data: job, error: insertError } = await admin
      .from('media_generation_jobs')
      .insert({
        account_id: accountId,
        project_id: projectId ?? null,
        client_id: resolvedClientId,
        created_by: user.id,
        provider: 'fal',
        model_id: fluxSchnellRecipe.modelId,
        type: 'image',
        status: 'processing',
        prompt,
        refs: refImageUrl ? [{ url: refImageUrl }] : [],
        params: {},
        media_credits_charged: units,
      })
      .select('*')
      .single();

    if (insertError || !job) {
      return NextResponse.json(
        { error: insertError?.message ?? 'Failed to create job' },
        { status: 500 },
      );
    }

    const jobId = (job as { id: string }).id;

    try {
      await debitMediaCredits(accountId, units, jobId);
    } catch (error) {
      await admin
        .from('media_generation_jobs')
        .update({
          status: 'failed',
          error_message: isInsufficientMediaCreditsError(error)
            ? error.message
            : 'Credit debit failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (isInsufficientMediaCreditsError(error)) {
        return NextResponse.json(
          {
            error: error.message,
            balance: error.balance,
            required: error.required,
            code: 'INSUFFICIENT_MEDIA_CREDITS',
          },
          { status: 402 },
        );
      }

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Debit failed' },
        { status: 500 },
      );
    }

    try {
      const input = fluxSchnellRecipe.buildInput({
        prompt,
        refImageUrl,
      });
      const response = await falRun<
        import('~/lib/media-generation/models/flux-schnell').FluxSchnellResponse
      >(fluxSchnellRecipe.modelId, input as unknown as Record<string, unknown>);

      const remoteUrl = fluxSchnellRecipe.extractOutputUrl(response);
      if (!remoteUrl) {
        throw new FalProviderError(502, 'No image URL in fal response');
      }

      const stored = await persistRemoteMediaToStorage({
        accountId,
        remoteUrl,
        pathSuffix: `results/${jobId}.png`,
        contentTypeHint: 'image/png',
      });

      const { data: updated, error: updateError } = await admin
        .from('media_generation_jobs')
        .update({
          status: 'complete',
          file_url: stored.signedUrl,
          thumbnail_url: stored.signedUrl,
          provider_cost_usd: fluxSchnellRecipe.providerCostUsdEstimate,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .select('*')
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      return NextResponse.json({ job: updated });
    } catch (error) {
      await refundMediaCredits(jobId, 'provider_failure');
      const message =
        error instanceof FalProviderError
          ? `Provider error (${error.status})`
          : error instanceof Error
            ? error.message
            : 'Generation failed';

      const { data: failed } = await admin
        .from('media_generation_jobs')
        .update({
          status: 'failed',
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .select('*')
        .single();

      return NextResponse.json(
        { error: message, job: failed },
        { status: 502 },
      );
    }
  },
  { auth: true },
);
