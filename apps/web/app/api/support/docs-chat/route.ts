import { type NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';
import { answerSupportDocsQuestion } from '~/lib/support/docs-chat';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(1000),
      }),
    )
    .max(6)
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const limited = rateLimitApiRequest(request, {
      scope: 'support-docs-chat',
      limit: 20,
      subject: user.id,
    });
    if (limited) return limited;

    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await answerSupportDocsQuestion({
      message: parsed.data.message,
      history: parsed.data.history,
    });

    return NextResponse.json(result);
  } catch (error) {
    // Do not log message bodies — privacy minimisation for Ask docs.
    console.error('[support-docs-chat] failed', {
      name: error instanceof Error ? error.name : 'Error',
    });
    return NextResponse.json(
      { error: 'Could not answer from docs right now' },
      { status: 500 },
    );
  }
}
