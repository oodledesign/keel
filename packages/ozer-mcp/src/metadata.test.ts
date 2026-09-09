import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SUPABASE_AUTH_SERVER,
  SUPABASE_OAUTH_AS_DISCOVERY_URL,
} from './config';
import {
  getOAuthAuthorizationServers,
  getOAuthProtectedResourceMetadata,
  getOAuthWwwAuthenticateHeader,
  isMcpProtectedResourceMetadataPath,
} from './metadata';

describe('ozer-mcp protected resource metadata', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('advertises the issuer first, then Supabase path-insertion discovery', () => {
    expect(getOAuthAuthorizationServers()).toEqual([
      SUPABASE_AUTH_SERVER,
      SUPABASE_OAUTH_AS_DISCOVERY_URL,
    ]);
  });

  it('includes RFC 9728 fields ChatGPT and Claude need', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_SITE_URL', 'https://app.ozer.so');

    const metadata = getOAuthProtectedResourceMetadata();

    expect(metadata.resource).toBe('https://app.ozer.so/api/mcp');
    expect(metadata.scopes_supported).toEqual(['openid', 'email', 'profile']);
    expect(metadata.bearer_methods_supported).toEqual(['header']);
    expect(metadata.authorization_servers[0]).toBe(SUPABASE_AUTH_SERVER);
    expect(metadata.scopes_supported).not.toContain('offline_access');
  });

  it('challenges with path-inserted resource metadata and scopes', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_SITE_URL', 'https://app.ozer.so');

    expect(getOAuthWwwAuthenticateHeader()).toBe(
      'Bearer resource_metadata="https://app.ozer.so/.well-known/oauth-protected-resource/api/mcp", scope="openid email profile"',
    );
  });

  it('accepts root and /api/mcp well-known paths only', () => {
    expect(isMcpProtectedResourceMetadataPath([])).toBe(true);
    expect(isMcpProtectedResourceMetadataPath(['api', 'mcp'])).toBe(true);
    expect(isMcpProtectedResourceMetadataPath(['api'])).toBe(false);
    expect(isMcpProtectedResourceMetadataPath(['other'])).toBe(false);
  });
});
