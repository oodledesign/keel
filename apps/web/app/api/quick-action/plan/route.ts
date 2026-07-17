import { type NextRequest, NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { planQuickAction } from '~/lib/quick-action/agent';
import { createQuickActionContext } from '~/lib/quick-action/context';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  context: z
    .object({
      accountId: z.string().uuid().optional(),
      accountSlug: z.string().trim().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseServerClient() as SupabaseClient;
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const limited = rateLimitApiRequest(request, {
      scope: 'quick-action-plan',
      limit: 30,
      subject: user.id,
    });
    if (limited) return limited;

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const ctx = await createQuickActionContext(
      client,
      user.id,
      parsed.data.context ?? {},
    );

    const result = await planQuickAction(ctx, parsed.data.message);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[quick-action] plan', error);
    const message =
      error instanceof Error ? error.message : 'Failed to plan quick action';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
