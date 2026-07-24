import { z } from 'zod';

const optionalGscEnv = z.object({
  GOOGLE_GSC_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_GSC_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_GSC_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

function defaultGscRedirectUri(siteUrl: string | undefined) {
  if (!siteUrl) {
    return undefined;
  }

  return `${siteUrl.replace(/\/$/, '')}/api/rankly/gsc/callback`;
}

export function getOptionalGscEnv() {
  const parsed = optionalGscEnv.safeParse(process.env);
  if (!parsed.success) {
    return null;
  }

  const env = parsed.data;
  const clientId =
    env.GOOGLE_GSC_CLIENT_ID ??
    env.GOOGLE_OAUTH_CLIENT_ID ??
    env.GOOGLE_CLIENT_ID;
  const clientSecret =
    env.GOOGLE_GSC_CLIENT_SECRET ??
    env.GOOGLE_OAUTH_CLIENT_SECRET ??
    env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    env.GOOGLE_GSC_REDIRECT_URI ?? defaultGscRedirectUri(env.NEXT_PUBLIC_SITE_URL);

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function getGscEnv() {
  const env = getOptionalGscEnv();
  if (!env) {
    throw new Error(
      'Google Search Console OAuth is not configured. Set GOOGLE_GSC_CLIENT_ID, GOOGLE_GSC_CLIENT_SECRET, and GOOGLE_GSC_REDIRECT_URI (or NEXT_PUBLIC_SITE_URL).',
    );
  }
  return env;
}

export function isGscConfigured() {
  return getOptionalGscEnv() != null;
}
