import { type NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import type { MealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { formatUserFacingAiError } from '~/lib/ai/format-ai-provider-error';
import { extractRecipe } from '~/lib/ai/recipe-extract';
import { sourceUrlsMatch } from '~/lib/ai/recipe-import-polish';
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

const requestSchema = z
  .object({
    source: z.enum(['text', 'image', 'url']),
    payload: z.string().min(1).max(6_000_000),
    accountSlug: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.source !== 'url') return;
    try {
      const parsed = new URL(value.payload.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'URL must use http or https',
          path: ['payload'],
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid URL',
        path: ['payload'],
      });
    }
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

    const existing = await findExistingRecipeBySourceUrl(
      client as never,
      scope,
      result.recipe.source_url,
    );

    return NextResponse.json({
      recipe: result.recipe,
      method: result.method,
      warnings: result.warnings,
      existing,
    });
  } catch (err) {
    if (isInsufficientCreditsError(err)) {
      return NextResponse.json(insufficientCreditsResponse(err), {
        status: 402,
      });
    }

    const raw = err instanceof Error ? err.message : '';
    const isSafeMessage =
      /cannot be fetched|too large|empty or invalid|No recipe|No readable|Could not fetch|Could not read this Instagram|paywalled|login-gated|could not be found|slow down|Paste the recipe|screenshot|private/i.test(
        raw,
      );

    const message = isSafeMessage
      ? raw
      : formatUserFacingAiError(err, 'Could not extract recipe');
    const status = isSafeMessage ? 422 : 502;

    return NextResponse.json({ error: message }, { status });
  }
}

async function findExistingRecipeBySourceUrl(
  client: ReturnType<typeof getSupabaseServerClient>,
  scope: MealPlanScope,
  sourceUrl: string | null,
): Promise<{ id: string; name: string } | null> {
  if (!sourceUrl) return null;

  let query = client
    .from('family_recipes')
    .select('id, name, source_url')
    .limit(1_000);

  if (scope.kind === 'workspace') {
    query = query.eq('account_id', scope.accountId);
  } else {
    query = query.eq('user_id', scope.userId).is('account_id', null);
  }

  const { data, error } = await query;
  if (error || !data) return null;

  for (const row of data) {
    const record = row as {
      id: string;
      name: string;
      source_url: string | null;
    };
    if (sourceUrlsMatch(record.source_url, sourceUrl)) {
      return { id: record.id, name: record.name };
    }
  }

  return null;
}
