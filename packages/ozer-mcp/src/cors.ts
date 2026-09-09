const MCP_CORS_ALLOW_HEADERS = [
  'Authorization',
  'Content-Type',
  'Accept',
  'MCP-Session-Id',
  'MCP-Protocol-Version',
  'Last-Event-ID',
].join(', ');

const MCP_CORS_EXPOSE_HEADERS = [
  'WWW-Authenticate',
  'MCP-Session-Id',
  'MCP-Protocol-Version',
].join(', ');

export const MCP_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': MCP_CORS_ALLOW_HEADERS,
  'Access-Control-Expose-Headers': MCP_CORS_EXPOSE_HEADERS,
  'Access-Control-Max-Age': '86400',
};

export function withMcpCors(response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(MCP_CORS_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function mcpCorsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: MCP_CORS_HEADERS,
  });
}
