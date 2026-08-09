import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { estimateJobCost } from '~/lib/billing/media-unit-pricing';
import { minimaxVideoRecipe } from '~/lib/media-generation/models/minimax-video';
import { isMediaGenerateEnabled } from '~/lib/media-generation/module-access';
import {
  FalProviderError,
  falQueueSubmit,
} from '~/lib/media-generation/providers/fal';
import { userIsAccountMember } from '~/lib/rankly/account-membership';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  accountId: z.string().uuid(),
  prompt: z.string().trim().min(1).max(4000),
  projectId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  durationSeconds: z.number().int().min(1).max(20).optional(),
  /** Explicit confirm required for video jobs. */
  confirmed: z.literal(true),
});

/**
 * Submit an async video job. Credits are debited on confirmed completion
 * (see /api/cron/media-video-poll), not at submit time.
 */
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
      durationSeconds = minimaxVideoRecipe.defaultDurationSeconds,
    } = parsed.data;

    const client = getSupabaseServerClient();
    const isMember =
      accountId === user.id ||
      (await userIsAccountMember(client, user.id, accountId));

    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!(await isMediaGenerateEnabled(accountId))) {
      return NextResponse.json(
        { error: 'Media generation is disabled for this workspace.' },
        { status: 403 },
      );
    }

    const units = estimateJobCost(minimaxVideoRecipe.modelId, {
      durationSeconds,
    });

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

    try {
      const submit = await falQueueSubmit(
        minimaxVideoRecipe.modelId,
        minimaxVideoRecipe.buildInput({ prompt }) as unknown as Record<
          string,
          unknown
        >,
      );

      const { data: job, error } = await admin
        .from('media_generation_jobs')
        .insert({
          account_id: accountId,
          project_id: projectId ?? null,
          client_id: resolvedClientId,
          created_by: user.id,
          provider: 'fal',
          model_id: minimaxVideoRecipe.modelId,
          type: 'video',
          status: 'processing',
          prompt,
          refs: [],
          params: { durationSeconds, estimatedUnits: units },
          media_credits_charged: null,
          external_job_id: submit.request_id,
        })
        .select('*')
        .single();

      if (error || !job) {
        return NextResponse.json(
          { error: error?.message ?? 'Failed to create job' },
          { status: 500 },
        );
      }

      return NextResponse.json({
        job,
        estimatedUnits: units,
        note: 'Credits are charged when the video completes successfully.',
      });
    } catch (error) {
      const message =
        error instanceof FalProviderError
          ? `Provider error (${error.status})`
          : error instanceof Error
            ? error.message
            : 'Submit failed';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  },
  { auth: true },
);
