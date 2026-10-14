import 'server-only';

import { z } from 'zod';

/**
 * Instagram Business Login credentials.
 * Must use the Instagram App ID + Secret from Meta → Instagram → API setup
 * → Business login settings. Do NOT use App settings → Basic (Facebook App ID).
 */
export function getOptionalMetaInstagram() {
  const appId =
    process.env.META_INSTAGRAM_APP_ID?.trim() ||
    process.env.INSTAGRAM_APP_ID?.trim();
  const appSecret =
    process.env.META_INSTAGRAM_APP_SECRET?.trim() ||
    process.env.INSTAGRAM_APP_SECRET?.trim();
  const redirectUri =
    process.env.META_REDIRECT_URI?.trim() ||
    process.env.INSTAGRAM_REDIRECT_URI?.trim();
  if (!appId || !appSecret || !redirectUri) {
    return null;
  }
  if (!z.string().url().safeParse(redirectUri).success) {
    return null;
  }
  return { appId, appSecret, redirectUri };
}

export function getMetaWebhookVerifyToken(): string | null {
  const token =
    process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ||
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim();
  return token || null;
}

/**
 * Features that need Meta App Review (Advanced Access) before they work for
 * non-tester accounts: Ice Breakers, persistent menu and story mentions.
 * Everything else works in development mode for app testers.
 */
export function isIgAppReviewApproved(): boolean {
  return process.env.IG_APP_REVIEW_APPROVED?.trim().toLowerCase() === 'true';
}

const DEFAULT_IG_HOURLY_SEND_CAP = 200;

/** Per connected account, across all automations. Plan limits can only lower it. */
export function getIgHourlySendCap(): number {
  const raw = Number(process.env.IG_HOURLY_SEND_CAP);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_IG_HOURLY_SEND_CAP;
}

/**
 * App secret for Meta webhook HMAC (X-Hub-Signature-256).
 * Use the main App Secret from App settings → Basic, not the Instagram-only secret.
 */
export function getMetaAppSecret(): string | null {
  return (
    process.env.META_APP_SECRET?.trim() ||
    process.env.META_INSTAGRAM_APP_SECRET?.trim() ||
    process.env.INSTAGRAM_APP_SECRET?.trim() ||
    null
  );
}
