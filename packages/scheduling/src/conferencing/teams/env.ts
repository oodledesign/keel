import { z } from 'zod';

const optionalEnv = z.object({
  MICROSOFT_TEAMS_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_TEAMS_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_TEAMS_REDIRECT_URI: z.string().url().optional(),
  MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_REDIRECT_URI: z.string().url().optional(),
  /** Optional tenant; defaults to `common` for multi-tenant apps. */
  MICROSOFT_TEAMS_TENANT_ID: z.string().min(1).optional(),
});

export function getOptionalTeamsOAuthEnv() {
  const parsed = optionalEnv.safeParse(process.env);
  if (!parsed.success) return null;

  const env = parsed.data;
  const clientId = env.MICROSOFT_TEAMS_CLIENT_ID ?? env.MICROSOFT_CLIENT_ID;
  const clientSecret =
    env.MICROSOFT_TEAMS_CLIENT_SECRET ?? env.MICROSOFT_CLIENT_SECRET;
  const redirectUri =
    env.MICROSOFT_TEAMS_REDIRECT_URI ?? env.MICROSOFT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    tenantId: env.MICROSOFT_TEAMS_TENANT_ID ?? 'common',
  };
}

export function getTeamsOAuthEnv() {
  const env = getOptionalTeamsOAuthEnv();
  if (!env) {
    throw new Error(
      'Microsoft Teams OAuth is not configured. Set MICROSOFT_TEAMS_CLIENT_ID, MICROSOFT_TEAMS_CLIENT_SECRET, and MICROSOFT_TEAMS_REDIRECT_URI.',
    );
  }
  return env;
}
