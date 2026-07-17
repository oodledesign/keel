import { z } from 'zod';

const optionalEnv = z.object({
  ZOOM_CLIENT_ID: z.string().min(1).optional(),
  ZOOM_CLIENT_SECRET: z.string().min(1).optional(),
  ZOOM_REDIRECT_URI: z.string().url().optional(),
  ZOOM_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  ZOOM_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  ZOOM_OAUTH_REDIRECT_URI: z.string().url().optional(),
});

export function getOptionalZoomOAuthEnv() {
  const parsed = optionalEnv.safeParse(process.env);
  if (!parsed.success) return null;

  const env = parsed.data;
  const clientId = env.ZOOM_OAUTH_CLIENT_ID ?? env.ZOOM_CLIENT_ID;
  const clientSecret = env.ZOOM_OAUTH_CLIENT_SECRET ?? env.ZOOM_CLIENT_SECRET;
  const redirectUri = env.ZOOM_OAUTH_REDIRECT_URI ?? env.ZOOM_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function getZoomOAuthEnv() {
  const env = getOptionalZoomOAuthEnv();
  if (!env) {
    throw new Error(
      'Zoom OAuth is not configured. Set ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, and ZOOM_REDIRECT_URI.',
    );
  }
  return env;
}
