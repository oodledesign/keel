import 'server-only';

export function getStarlingEnv() {
  const clientId = process.env.STARLING_CLIENT_ID?.trim();
  const clientSecret = process.env.STARLING_CLIENT_SECRET?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  const sandbox = process.env.STARLING_SANDBOX !== 'false';

  if (!clientId || !clientSecret) {
    throw new Error(
      'STARLING_CLIENT_ID and STARLING_CLIENT_SECRET must be configured',
    );
  }
  if (!siteUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL must be configured for Starling OAuth');
  }

  const oauthBase = sandbox
    ? 'https://oauth-sandbox.starlingbank.com'
    : 'https://oauth.starlingbank.com';
  const apiBase = sandbox
    ? 'https://api-sandbox.starlingbank.com'
    : 'https://api.starlingbank.com';
  const tokenUrl = sandbox
    ? 'https://api-sandbox.starlingbank.com/oauth/access-token'
    : 'https://token-api.starlingbank.com/oauth/access-token';

  return {
    clientId,
    clientSecret,
    redirectUri: `${siteUrl}/api/integrations/starling/callback`,
    oauthBase,
    apiBase,
    tokenUrl,
    sandbox,
  };
}

export function isStarlingConfigured() {
  return Boolean(
    process.env.STARLING_CLIENT_ID?.trim() &&
      process.env.STARLING_CLIENT_SECRET?.trim(),
  );
}
