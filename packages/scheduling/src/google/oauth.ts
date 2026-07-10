import { z } from 'zod';

const optionalEnv = z.object({
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CALENDAR_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
});

export function getOptionalGoogleCalendarOAuthEnv() {
  const parsed = optionalEnv.safeParse(process.env);
  if (!parsed.success) return null;

  const env = parsed.data;
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID ?? env.GOOGLE_CLIENT_ID;
  const clientSecret =
    env.GOOGLE_OAUTH_CLIENT_SECRET ?? env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    env.GOOGLE_CALENDAR_REDIRECT_URI ?? env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function getGoogleCalendarOAuthEnv() {
  const env = getOptionalGoogleCalendarOAuthEnv();
  if (!env) {
    throw new Error(
      'Google Calendar OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI.',
    );
  }
  return env;
}
