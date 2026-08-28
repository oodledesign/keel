import { type NextRequest, NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { generateFixSnippet } from '~/lib/ai-audit/claude-scorer';
import {
  getRecommendationForUser,
  updateRecommendationSnippet,
} from '~/lib/ai-audit/db';
import { formatUserFacingAiError } from '~/lib/ai/format-ai-provider-error';
import {
  insufficientCreditsResponse,
  isInsufficientCreditsError,
} from '~/lib/ai/router';
import { resolveRanklyProjectAccountId } from '~/lib/page-optimize/claude-analyser';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { denyUnlessRanklyAddonForProject } from '~/lib/rankly/require-rankly-api-access';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const runtime = 'nodejs';

const fixSchema = z.object({
  recommendationId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }

    const body = await request.json();
    const parsed = fixSchema.safeParse(body);
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400);
    }

    const rec = await getRecommendationForUser(
      parsed.data.recommendationId,
      user.id,
    );

    if (!rec) {
      return jsonErr('NOT_FOUND', 'Recommendation not found', 404);
    }

    const { data: report } = await supabaseCustomSchema(client, 'rankly')
      .from('ai_audit_reports')
      .select('job_id')
      .eq('id', rec.report_id)
      .maybeSingle();

    const { data: job } = report
      ? await supabaseCustomSchema(client, 'rankly')
          .from('ai_audit_jobs')
          .select('project_id')
          .eq('id', report.job_id)
          .eq('user_id', user.id)
          .maybeSingle()
      : { data: null };

    if (!job?.project_id) {
      return jsonErr('NOT_FOUND', 'Recommendation not found', 404);
    }

    const addonDenied = await denyUnlessRanklyAddonForProject(
      client,
      user.id,
      job.project_id as string,
    );
    if (addonDenied) return addonDenied;

    if (rec.fix_snippet) {
      return jsonOk({ snippet: rec.fix_snippet });
    }

    const snippet = await generateFixSnippet(
      {
        title: rec.title,
        description: rec.description,
        exampleUrl: rec.example_urls?.[0] ?? 'homepage',
        dimension: rec.dimension,
      },
      {
        accountId: await resolveRanklyProjectAccountId(
          job.project_id as string,
        ),
        supabase: client,
      },
    );

    await updateRecommendationSnippet(parsed.data.recommendationId, snippet);

    return jsonOk({ snippet });
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      return NextResponse.json(insufficientCreditsResponse(error), {
        status: 402,
      });
    }

    return jsonErr(
      'UNKNOWN',
      formatUserFacingAiError(error, 'Error'),
      500,
    );
  }
}
