import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { executeQuickAction } from '~/lib/quick-action/execute';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  actionToken: z.string().trim().min(1),
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
      scope: 'quick-action-execute',
      limit: 20,
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

    const result = await executeQuickAction(
      client,
      user.id,
      parsed.data.actionToken,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[quick-action] execute', error);
    const message =
      error instanceof Error ? error.message : 'Failed to execute quick action';
    const status = message.includes('token') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
