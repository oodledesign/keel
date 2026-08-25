import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import appConfig from '~/config/app.config';
import {
  REWARDS_CONFIG,
  buildReferralCookieOptions,
  hashReferralSessionFingerprint,
} from '~/lib/rewards/referral-cookies';

type RouteContext = {
  params: Promise<{ code: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { code: rawCode } = await context.params;
  const code = rawCode.trim().toLowerCase();

  if (!/^[a-z0-9]{6,12}$/.test(code)) {
    return NextResponse.redirect(new URL('/auth/sign-up', request.url));
  }

  const url = new URL(request.url);
  const utmSource =
    url.searchParams.get('utm_source')?.trim().slice(0, 64) || 'direct';

  const admin = getSupabaseServerAdminClient();
  const { data: referrer } = await admin
    .from('user_settings')
    .select('user_id')
    .eq('referral_code', code)
    .maybeSingle();

  if (!referrer?.user_id) {
    return NextResponse.redirect(new URL('/auth/sign-up', request.url));
  }

  const fingerprint = hashReferralSessionFingerprint({
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
  });

  await admin.from('referral_clicks').insert({
    referral_code: code,
    referrer_user_id: referrer.user_id,
    utm_source: utmSource,
    session_fingerprint: fingerprint,
  });

  const response = NextResponse.redirect(new URL('/auth/sign-up', request.url));
  const cookieOptions = buildReferralCookieOptions(appConfig.production);

  response.cookies.set(REWARDS_CONFIG.referralCookieName, code, cookieOptions);
  response.cookies.set(
    REWARDS_CONFIG.referralUtmCookieName,
    utmSource,
    cookieOptions,
  );

  return response;
}
