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

type SignUpSuccessPayload = {
  user: unknown;
  session: unknown;
};

function signUpSuccessResponse(payload: SignUpSuccessPayload) {
  return NextResponse.json(payload);
}

function queueSignupSideEffects(user: { id: string; email: string }) {
  // Notify first so a referral setup failure cannot skip ops mail.
  void import('~/lib/admin/platform-lifecycle-notifications')
    .then(({ notifyPlatformNewSignup }) =>
      notifyPlatformNewSignup({
        email: user.email,
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

  try {
    const admin = getSupabaseServerAdminClient();
    void attributeReferralAtSignup({
      referredUserId: user.id,
      admin,
    }).catch((err) => {
      console.error(
        '[sign-up] Referral attribution failed:',
        err instanceof Error ? err.message : err,
      );
    });
  } catch (err) {
    console.error(
      '[sign-up] Referral attribution failed:',
      err instanceof Error ? err.message : err,
    );
  }
}

export async function POST(request: Request) {
  let created: SignUpSuccessPayload | null = null;

  try {
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
      console.error('[sign-up] signUp failed', {
        code: error.code,
        status: error.status,
        message: error.message,
      });

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

    if (user) {
      created = {
        user,
        session: data.session,
      };

      if (user.id && user.email) {
        queueSignupSideEffects({ id: user.id, email: user.email });
      }

      return signUpSuccessResponse(created);
    }

    return signUpSuccessResponse({
      user: data.user,
      session: data.session,
    });
  } catch (err) {
    if (created) {
      console.error(
        '[sign-up] Post-signup error (user already created):',
        err instanceof Error ? err.message : err,
      );
      return signUpSuccessResponse(created);
    }

    console.error(
      '[sign-up] Uncaught error:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: 'sign_up_failed' }, { status: 500 });
  }
}
