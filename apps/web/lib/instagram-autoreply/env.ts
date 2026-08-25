import 'server-only';

import { z } from 'zod';

export function getOptionalMetaInstagram() {
  const appId = process.env.META_APP_ID ?? process.env.INSTAGRAM_APP_ID;
  const appSecret =
    process.env.META_APP_SECRET ?? process.env.INSTAGRAM_APP_SECRET;
  const redirectUri =
    process.env.META_REDIRECT_URI ?? process.env.INSTAGRAM_REDIRECT_URI;
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
    process.env.META_APP_SECRET?.trim() ||
    process.env.INSTAGRAM_APP_SECRET?.trim() ||
    null
  );
}
