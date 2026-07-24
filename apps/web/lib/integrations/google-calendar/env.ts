import { z } from 'zod';

const optionalGoogleCalendarEnv = z.object({
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CALENDAR_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  // Shared Gmail OAuth client fallback (same Google Cloud client often lists both callbacks).
  GOOGLE_GMAIL_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_GMAIL_CLIENT_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

function defaultCalendarRedirectUri(siteUrl: string | undefined) {
  if (!siteUrl) {
    return undefined;
  }

  return `${siteUrl.replace(/\/$/, '')}/api/integrations/google-calendar/callback`;
}

export function getOptionalGoogleCalendarEnv() {
  const parsed = optionalGoogleCalendarEnv.safeParse(process.env);
  if (!parsed.success) {
    return null;
  }

  const env = parsed.data;
  const clientId =
    env.GOOGLE_OAUTH_CLIENT_ID ??
    env.GOOGLE_CLIENT_ID ??
    env.GOOGLE_GMAIL_CLIENT_ID;
  const clientSecret =
    env.GOOGLE_OAUTH_CLIENT_SECRET ??
    env.GOOGLE_CLIENT_SECRET ??
    env.GOOGLE_GMAIL_CLIENT_SECRET;
  const redirectUri =
    env.GOOGLE_CALENDAR_REDIRECT_URI ??
    // Never fall back to GOOGLE_REDIRECT_URI / Gmail callback — those are a different path
    // and cause redirect_uri_mismatch when only the calendar callback is authorized.
    defaultCalendarRedirectUri(env.NEXT_PUBLIC_SITE_URL);

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function getGoogleCalendarEnv() {
  const env = getOptionalGoogleCalendarEnv();
  if (!env) {
    throw new Error(
      'Google Calendar OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI (or NEXT_PUBLIC_SITE_URL).',
    );
  }
  return env;
}

export function isPlannerMockCalendarEnabled() {
  return process.env.PLANNER_MOCK_CALENDAR === 'true';
}
