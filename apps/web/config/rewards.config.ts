const parseIntEnv = (key: string, fallback: number) => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
};

export const REWARDS_CONFIG = {
  contentTiersPence: {
    story: 250,
    image_post: 500,
    reel: 1000,
  } as const,
  contentMonthlyCapPence: 2000,
  contentAnnualCapPence: 18000,
  minFollowerCount: parseIntEnv('REWARDS_MIN_FOLLOWERS', 100),
  minAccountAgeDays: 30,
  referrerRewardPercent: 0.5,
  referredDiscountPercent: 0.5,
  /** Fallback monthly plan when referrer has no paid subscription (Community £12). */
  referrerFallbackMonthlyGbp: 12,
  referralCookieName: 'ozer_ref',
  referralUtmCookieName: 'ozer_ref_utm',
  referralCookieMaxAgeDays: 30,
} as const;

export type ContentSubmissionType =
  keyof typeof REWARDS_CONFIG.contentTiersPence;

export function contentTierRewardPence(type: ContentSubmissionType): number {
  return REWARDS_CONFIG.contentTiersPence[type];
}

export function getReferralLink(code: string, siteUrl?: string): string {
  const base =
    siteUrl ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://ozer.so';
  return `${base.replace(/\/$/, '')}/r/${code}`;
}
