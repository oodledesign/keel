import 'server-only';

export function getFreeAgentEnv() {
  const clientId = process.env.FREEAGENT_CLIENT_ID?.trim();
  const clientSecret = process.env.FREEAGENT_CLIENT_SECRET?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  const sandbox = process.env.FREEAGENT_SANDBOX === 'true';

  if (!clientId || !clientSecret) {
    throw new Error(
      'FREEAGENT_CLIENT_ID and FREEAGENT_CLIENT_SECRET must be configured',
    );
  }
  if (!siteUrl) {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL must be configured for FreeAgent OAuth',
    );
  }

  const apiBase = sandbox
    ? 'https://api.sandbox.freeagent.com/v2'
    : 'https://api.freeagent.com/v2';

  return {
    clientId,
    clientSecret,
    redirectUri: `${siteUrl}/api/integrations/freeagent/callback`,
    apiBase,
    sandbox,
  };
}

export function isFreeAgentConfigured() {
  return Boolean(
    process.env.FREEAGENT_CLIENT_ID?.trim() &&
    process.env.FREEAGENT_CLIENT_SECRET?.trim(),
  );
}
