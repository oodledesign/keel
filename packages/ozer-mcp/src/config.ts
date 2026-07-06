const SUPABASE_PROJECT_ORIGIN = 'https://igewpbdkvvhclfprteca.supabase.co';

const SUPABASE_PROJECT_AUTH_BASE = `${SUPABASE_PROJECT_ORIGIN}/auth/v1`;

export const SUPABASE_AUTH_SERVER = SUPABASE_PROJECT_AUTH_BASE;

/** Non-standard AS metadata path used by Supabase OAuth 2.1 Server. */
export const SUPABASE_OAUTH_AS_DISCOVERY_URL = `${SUPABASE_PROJECT_ORIGIN}/.well-known/oauth-authorization-server/auth/v1`;

export const SUPABASE_JWKS_URL = `${SUPABASE_PROJECT_AUTH_BASE}/.well-known/jwks.json`;

export function getMcpAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_SITE_URL?.replace(/\/+$/, '') ??
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ??
    'http://localhost:3000'
  );
}

export function getMcpResourceUrl(): string {
  return `${getMcpAppOrigin()}/api/mcp`;
}

export function getOAuthProtectedResourceMetadataUrl(): string {
  return `${getMcpAppOrigin()}/.well-known/oauth-protected-resource`;
}

export function getMcpConnectorIconUrl(): string {
  return `${getMcpAppOrigin()}/brand/ozer-connector-icon.svg`;
}

export function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    ''
  );
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    ''
  );
}
