import { type NextRequest } from 'next/server';
import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { generateFixSnippet } from '~/lib/ai-audit/claude-scorer';
import {
  getRecommendationForUser,
  updateRecommendationSnippet,
} from '~/lib/ai-audit/db';
import { jsonErr, jsonOk } from '~/lib/rankly/api-response';

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

    if (rec.fix_snippet) {
      return jsonOk({ snippet: rec.fix_snippet });
    }

    const snippet = await generateFixSnippet({
      title: rec.title,
      description: rec.description,
      exampleUrl: rec.example_urls?.[0] ?? 'homepage',
      dimension: rec.dimension,
    });

    await updateRecommendationSnippet(parsed.data.recommendationId, snippet);

    return jsonOk({ snippet });
  } catch (error) {
    return jsonErr(
      'UNKNOWN',
      error instanceof Error ? error.message : 'Error',
      500,
    );
  }
}
