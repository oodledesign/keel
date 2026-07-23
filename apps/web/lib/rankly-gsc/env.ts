import { z } from 'zod';

const optionalGscEnv = z.object({
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_GSC_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

export function getOptionalGscEnv() {
  const parsed = optionalGscEnv.safeParse(process.env);
  if (!parsed.success) {
    return null;
  }

  const env = parsed.data;
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID ?? env.GOOGLE_CLIENT_ID;
  const clientSecret =
    env.GOOGLE_OAUTH_CLIENT_SECRET ?? env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    env.GOOGLE_GSC_REDIRECT_URI ??
    (env.NEXT_PUBLIC_SITE_URL
      ? `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/api/rankly/gsc/callback`
      : undefined);

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function getGscEnv() {
  const env = getOptionalGscEnv();
  if (!env) {
    throw new Error(
      'Google Search Console OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_GSC_REDIRECT_URI (or NEXT_PUBLIC_SITE_URL).',
    );
  }
  return env;
}

export function isGscConfigured() {
  return getOptionalGscEnv() != null;
}
