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

export function getMetaAppSecret(): string | null {
  return (
    process.env.META_INSTAGRAM_APP_SECRET?.trim() ||
    process.env.META_APP_SECRET?.trim() ||
    process.env.INSTAGRAM_APP_SECRET?.trim() ||
    null
  );
}
