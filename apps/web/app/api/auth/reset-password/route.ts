import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  authRateLimitKey,
  authRateLimitResponse,
  isAuthRateLimited,
} from '~/lib/rate-limit/auth-rate-limit';

const ResetPasswordSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().url(),
  captchaToken: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = ResetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const { email, redirectTo, captchaToken } = parsed.data;
  const rateLimitKey = authRateLimitKey('reset-password', email, request);

  if (isAuthRateLimited(rateLimitKey)) {
    return authRateLimitResponse();
  }

  const client = getSupabaseServerClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo,
    captchaToken,
  });

  if (error) {
    return NextResponse.json(
      { error: error.code ?? error.message },
      { status: error.status ?? 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
