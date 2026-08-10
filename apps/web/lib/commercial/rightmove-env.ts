import 'server-only';

/**
 * Rightmove Commercial Listings API (OAuth2 client credentials).
 *
 * Platform env (not per-workspace):
 * - RIGHTMOVE_CLIENT_ID
 * - RIGHTMOVE_CLIENT_KEY
 * - RIGHTMOVE_TOKEN_URL (defaults to staging)
 * - RIGHTMOVE_API_BASE_URL (defaults to staging)
 *
 * Staging: https://api-services.adftest.rightmove.com
 * Production: https://api-services.rightmove.co.uk
 */

const STAGING_BASE = 'https://api-services.adftest.rightmove.com';
const PRODUCTION_BASE = 'https://api-services.rightmove.co.uk';

export type RightmoveEnvironment = 'test' | 'production';

export type RightmoveEnvConfig = {
  clientId: string;
  clientKey: string;
  tokenUrl: string;
  apiBaseUrl: string;
  environment: RightmoveEnvironment;
};

export function isRightmoveOAuthConfigured(): boolean {
  return Boolean(
    process.env.RIGHTMOVE_CLIENT_ID?.trim() &&
    process.env.RIGHTMOVE_CLIENT_KEY?.trim(),
  );
}

export function getRightmoveEnv(): RightmoveEnvConfig {
  const clientId = process.env.RIGHTMOVE_CLIENT_ID?.trim();
  const clientKey = process.env.RIGHTMOVE_CLIENT_KEY?.trim();

  if (!clientId || !clientKey) {
    throw new Error(
      'RIGHTMOVE_CLIENT_ID and RIGHTMOVE_CLIENT_KEY are required for Rightmove sync',
    );
  }

  const apiBaseUrl = (
    process.env.RIGHTMOVE_API_BASE_URL?.trim() || STAGING_BASE
  ).replace(/\/$/, '');
  const tokenUrl =
    process.env.RIGHTMOVE_TOKEN_URL?.trim() || `${apiBaseUrl}/oauth/token`;

  const environment: RightmoveEnvironment =
    apiBaseUrl.includes('adftest') || apiBaseUrl.includes('test')
      ? 'test'
      : apiBaseUrl.includes('rightmove.co.uk')
        ? 'production'
        : 'test';

  return {
    clientId,
    clientKey,
    tokenUrl,
    apiBaseUrl,
    environment,
  };
}

export function getRightmoveEnvironmentLabel(): RightmoveEnvironment {
  try {
    return getRightmoveEnv().environment;
  } catch {
    return 'test';
  }
}

export {
  STAGING_BASE as RIGHTMOVE_STAGING_BASE,
  PRODUCTION_BASE as RIGHTMOVE_PRODUCTION_BASE,
};
