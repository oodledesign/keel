import { z } from 'zod';

/**
 * Feedflow module env (ported). Uses unified keel URLs; optional OAuth/video keys when enabled.
 */
const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  CRON_SECRET: z.string().min(1).optional(),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(32, 'TOKEN_ENCRYPTION_KEY must be at least 32 bytes (base64 or hex)'),
  OAUTH_STATE_SECRET: z.string().min(16).optional(),
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  INSTAGRAM_REDIRECT_URI: z.string().url().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
  TIKTOK_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  BUNNY_ACCOUNT_API_KEY: z.string().optional(),
  BUNNY_STREAM_LIBRARY_ID: z.string().optional(),
  BUNNY_STREAM_API_KEY: z.string().optional(),
  BUNNY_STREAM_READ_API_KEY: z.string().optional(),
  BUNNY_STREAM_CDN_HOSTNAME: z.string().optional(),
});

export type FeedflowServerEnv = z.infer<typeof serverSchema>;

let cached: FeedflowServerEnv | null = null;

export function getFeedflowServerEnv(): FeedflowServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid Feedflow environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }
  cached = parsed.data;
  return parsed.data;
}

/**
 * Provider-specific env only (no full Feedflow schema).
 * Used by UI and OAuth start routes so pages never throw when base env
 * (e.g. TOKEN_ENCRYPTION_KEY) is not configured yet — callbacks still use
 * {@link getFeedflowServerEnv} and will fail fast if secrets are missing.
 */
export function getOptionalInstagram() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
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
