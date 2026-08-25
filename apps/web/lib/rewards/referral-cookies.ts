import 'server-only';

import { cookies } from 'next/headers';

import { createHash } from 'crypto';

import { REWARDS_CONFIG } from '~/config/rewards.config';

const MAX_AGE_SECONDS = REWARDS_CONFIG.referralCookieMaxAgeDays * 24 * 60 * 60;

export function hashReferralSessionFingerprint(params: {
  ip: string | null;
  userAgent: string | null;
}): string {
  return createHash('sha256')
    .update(`${params.ip ?? 'unknown'}|${params.userAgent ?? 'unknown'}`)
    .digest('hex');
}

export async function readReferralCookies(): Promise<{
  code: string | null;
  utmSource: string | null;
}> {
  const jar = await cookies();
  const code = jar.get(REWARDS_CONFIG.referralCookieName)?.value ?? null;
  const utmSource =
    jar.get(REWARDS_CONFIG.referralUtmCookieName)?.value ?? null;

  return { code, utmSource };
}

export function buildReferralCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  };
}

export async function clearReferralCookies() {
  const jar = await cookies();
  jar.delete(REWARDS_CONFIG.referralCookieName);
  jar.delete(REWARDS_CONFIG.referralUtmCookieName);
}

export { REWARDS_CONFIG };
