import { z } from 'zod';

const optionalGoogleAuthEnv = z.object({
  GOOGLE_GMAIL_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_GMAIL_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_GMAIL_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

export function getOptionalGoogleAuthEnv() {
  const parsed = optionalGoogleAuthEnv.safeParse(process.env);

  if (!parsed.success) {
    return null;
  }

  const env = parsed.data;
  const clientId = env.GOOGLE_GMAIL_CLIENT_ID ?? env.GOOGLE_CLIENT_ID;
  const clientSecret =
    env.GOOGLE_GMAIL_CLIENT_SECRET ?? env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    env.GOOGLE_GMAIL_REDIRECT_URI ??
    (env.NEXT_PUBLIC_SITE_URL
      ? `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/api/google/callback`
      : undefined);

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function getGoogleAuthEnv() {
  const env = getOptionalGoogleAuthEnv();

  if (!env) {
    throw new Error(
      'Google OAuth is not configured. Set GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, and GOOGLE_GMAIL_REDIRECT_URI (or NEXT_PUBLIC_SITE_URL).',
    );
  }

  return env;
}
