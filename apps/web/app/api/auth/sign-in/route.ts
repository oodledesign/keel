import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  authRateLimitKey,
  authRateLimitResponse,
  isAuthRateLimited,
} from '~/lib/rate-limit/auth-rate-limit';

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = SignInSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 400 });
  }

  const { email, password, captchaToken } = parsed.data;
  const rateLimitKey = authRateLimitKey('sign-in', email, request);

  if (isAuthRateLimited(rateLimitKey)) {
    return authRateLimitResponse();
  }

  const client = getSupabaseServerClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });

  if (error) {
    const status = error.status === 429 ? 429 : 401;
    return NextResponse.json(
      { error: error.code ?? error.message },
      { status },
    );
  }

  return NextResponse.json({
    user: data.user,
    session: data.session,
  });
}
