import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  authRateLimitKey,
  authRateLimitResponse,
  isAuthRateLimited,
} from '~/lib/rate-limit/auth-rate-limit';
import { attributeReferralAtSignup } from '~/lib/rewards/attribute-referral-at-signup';

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  emailRedirectTo: z.string().url(),
  captchaToken: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = SignUpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_sign_up' }, { status: 400 });
  }

  const { email, password, emailRedirectTo, captchaToken } = parsed.data;
  const rateLimitKey = authRateLimitKey('sign-up', email, request);

  if (isAuthRateLimited(rateLimitKey)) {
    return authRateLimitResponse();
  }

  const client = getSupabaseServerClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      captchaToken,
    },
  });

  if (error) {
    if (error.code === 'weak_password') {
      const reasons =
        (error as unknown as { reasons?: string[] }).reasons ?? [];
      return NextResponse.json(
        { error: 'weak_password', reasons },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: error.code ?? error.message },
      { status: error.status ?? 400 },
    );
  }

  const user = data.user;
  const identities = user?.identities ?? [];

  if (identities.length === 0) {
    return NextResponse.json(
      { error: 'User already registered' },
      { status: 409 },
    );
  }

  if (user?.id && user.email) {
    void getSupabaseServerAdminClient()
      .then((admin) =>
        attributeReferralAtSignup({ referredUserId: user.id!, admin }),
      )
      .catch((err) => {
        console.error(
          '[sign-up] Referral attribution failed:',
          err instanceof Error ? err.message : err,
        );
      });

    void import('~/lib/admin/platform-lifecycle-notifications')
      .then(({ notifyPlatformNewSignup }) =>
        notifyPlatformNewSignup({
          email: user.email!,
          userId: user.id,
          source: 'email_password',
        }),
      )
      .catch((err) => {
        console.error(
          '[sign-up] Failed to queue signup notification:',
          err instanceof Error ? err.message : err,
        );
      });
  }

  return NextResponse.json({
    user: data.user,
    session: data.session,
  });
}
