import 'server-only';

import { z } from 'zod';

/**
 * Feedflow secrets used for token crypto and OAuth state.
 *
 * Supabase credentials live in Makerkit helpers
 * (`NEXT_PUBLIC_SUPABASE_PUBLIC_KEY` / `SUPABASE_SECRET_KEY` with legacy
 * aliases). Do not re-validate them here — that rejected installs that only
 * set the Makerkit names.
 */
const serverSchema = z.object({
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, 'TOKEN_ENCRYPTION_KEY must be at least 32 bytes (base64 or hex)'),
  OAUTH_STATE_SECRET: z.string().min(16).optional(),
});

export type FeedflowServerEnv = z.infer<typeof serverSchema>;

let cached: FeedflowServerEnv | null = null;

export function getFeedflowServerEnv(): FeedflowServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    OAUTH_STATE_SECRET: process.env.OAUTH_STATE_SECRET,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid Feedflow environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }
  cached = parsed.data;
  return parsed.data;
}

/** Test helper — clears the cached parse between Vitest cases. */
export function resetFeedflowServerEnvCacheForTests() {
  cached = null;
}

export const FEEDFLOW_INSTAGRAM_CALLBACK_PATH =
  '/api/feedflow/auth/instagram/callback';

function firstNonEmpty(
  ...values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function defaultFeedflowInstagramRedirectUri(): string | undefined {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (!site) return undefined;
  return `${site}${FEEDFLOW_INSTAGRAM_CALLBACK_PATH}`;
}

/**
 * Instagram Login credentials for Feedflow only.
 *
 * Prefer FEEDFLOW_INSTAGRAM_*. Fall back to legacy INSTAGRAM_* when the new
 * names are absent. Never read Auto-Reply's META_INSTAGRAM_* / META_REDIRECT_URI.
 */
export function getOptionalInstagram() {
  const appId = firstNonEmpty(
    process.env.FEEDFLOW_INSTAGRAM_APP_ID,
    process.env.INSTAGRAM_APP_ID,
  );
  const appSecret = firstNonEmpty(
    process.env.FEEDFLOW_INSTAGRAM_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET,
  );
  const redirectUri = firstNonEmpty(
    process.env.FEEDFLOW_INSTAGRAM_REDIRECT_URI,
    process.env.INSTAGRAM_REDIRECT_URI,
    defaultFeedflowInstagramRedirectUri(),
  );

  if (!appId || !appSecret || !redirectUri) {
    return null;
  }
  if (!z.string().url().safeParse(redirectUri).success) {
    return null;
  }

  return {
    appId,
    appSecret,
    redirectUri,
  };
}

export function getOptionalTikTok() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  if (!clientKey || !clientSecret || !redirectUri) {
    return null;
  }
  if (!z.string().url().safeParse(redirectUri).success) {
    return null;
  }
  return {
    clientKey,
    clientSecret,
    redirectUri,
  };
}

export function getOptionalGoogle() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  if (!z.string().url().safeParse(redirectUri).success) {
    return null;
  }
  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

export const FEEDFLOW_WEBFLOW_CALLBACK_PATH =
  '/api/feedflow/auth/webflow/callback';

/** Webflow OAuth app credentials; the redirect defaults to our callback. */
export function getOptionalWebflow() {
  const clientId = process.env.WEBFLOW_CLIENT_ID?.trim();
  const clientSecret = process.env.WEBFLOW_CLIENT_SECRET?.trim();
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  const redirectUri =
    process.env.WEBFLOW_REDIRECT_URI?.trim() ||
    (site ? `${site}${FEEDFLOW_WEBFLOW_CALLBACK_PATH}` : '');
  if (!clientId || !clientSecret || !redirectUri) return null;
  if (!z.string().url().safeParse(redirectUri).success) return null;
  return { clientId, clientSecret, redirectUri };
}
