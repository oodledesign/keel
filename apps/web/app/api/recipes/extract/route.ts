import { type NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { extractRecipe } from '~/lib/ai/recipe-extract';
import {
  insufficientCreditsResponse,
  isInsufficientCreditsError,
} from '~/lib/ai/router';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_PAYLOAD_BYTES = {
  text: 50_000,
  image: 6_000_000,
  url: 2_000,
} as const;

const requestSchema = z.object({
  source: z.enum(['text', 'image', 'url']),
  payload: z.string().min(1).max(6_000_000),
  accountSlug: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { source, payload, accountSlug } = parsed.data;

  if (payload.length > MAX_PAYLOAD_BYTES[source]) {
    return NextResponse.json(
      { error: 'Payload is too large' },
      { status: 413 },
    );
  }

  const generalLimit = rateLimitApiRequest(request, {
    scope: 'recipes-extract',
    limit: 30,
    subject: user.id,
  });
  if (generalLimit) return generalLimit;

  if (source === 'url') {
    const urlLimit = rateLimitApiRequest(request, {
      scope: 'recipes-extract-url',
      limit: 10,
      subject: user.id,
    });
    if (urlLimit) return urlLimit;
  }

  if (source === 'text' && payload.trim().length < 20) {
    return NextResponse.json(
      { error: 'Paste a bit more recipe text so we can extract it.' },
      { status: 400 },
    );
  }

  try {
    const scope = await resolveMealPlanScope(accountSlug);
    const result = await extractRecipe(source, payload, {
      accountId: scope.kind === 'workspace' ? scope.accountId : user.id,
      supabase: client,
    });

    return NextResponse.json({
      recipe: result.recipe,
      method: result.method,
    });
  } catch (err) {
    if (isInsufficientCreditsError(err)) {
      return NextResponse.json(insufficientCreditsResponse(err), {
        status: 402,
      });
    }

    const raw = err instanceof Error ? err.message : '';
    const isSafeMessage =
      /cannot be fetched|too large|empty or invalid|No recipe|No readable|Could not fetch|Could not read this Instagram/i.test(
        raw,
      );

    const message = isSafeMessage ? raw : 'Could not extract recipe';
    const status = isSafeMessage ? 422 : 502;

    return NextResponse.json({ error: message }, { status });
  }
}
