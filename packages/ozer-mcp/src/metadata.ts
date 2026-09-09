import {
  MCP_OAUTH_SCOPES,
  SUPABASE_OAUTH_AS_DISCOVERY_URL,
  getAuthorizationServerIssuer,
  getMcpAppOrigin,
  getMcpResourceUrl,
} from './config';

export function getOAuthAuthorizationServers(): string[] {
  // RFC 9728 / ChatGPT expect issuer identifiers. Claude's DCR previously
  // needed Supabase's path-insertion discovery URL, so keep both.
  const issuer = getAuthorizationServerIssuer();

  return issuer === SUPABASE_OAUTH_AS_DISCOVERY_URL
    ? [issuer]
    : [issuer, SUPABASE_OAUTH_AS_DISCOVERY_URL];
}

export function isMcpProtectedResourceMetadataPath(path: string[]): boolean {
  if (path.length === 0) {
    return true;
  }

  return path.length === 2 && path[0] === 'api' && path[1] === 'mcp';
}

export function getOAuthProtectedResourceMetadata() {
  return {
    resource: getMcpResourceUrl(),
    resource_name: 'Ozer',
    authorization_servers: getOAuthAuthorizationServers(),
    scopes_supported: [...MCP_OAUTH_SCOPES],
    bearer_methods_supported: ['header'] as const,
    resource_documentation: `${getMcpAppOrigin()}/home/settings`,
  };
}

export function getOAuthWwwAuthenticateHeader(): string {
  const resourceMetadata = `${getMcpAppOrigin()}/.well-known/oauth-protected-resource/api/mcp`;
  const scope = MCP_OAUTH_SCOPES.join(' ');

  return `Bearer resource_metadata="${resourceMetadata}", scope="${scope}"`;
}
