import { describe, expect, it } from 'vitest';

import {
  MCP_CORS_HEADERS,
  mcpCorsPreflightResponse,
  withMcpCors,
} from './cors';

describe('ozer-mcp CORS', () => {
  it('answers OPTIONS with 204 and MCP headers', () => {
    const response = mcpCorsPreflightResponse();

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
      'POST',
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
      'Authorization',
    );
    expect(response.headers.get('Access-Control-Expose-Headers')).toContain(
      'WWW-Authenticate',
    );
  });

  it('copies CORS onto an existing response without dropping status', () => {
    const response = withMcpCors(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer resource_metadata="https://example.test"',
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      MCP_CORS_HEADERS['Access-Control-Allow-Origin'],
    );
    expect(response.headers.get('WWW-Authenticate')).toContain(
      'resource_metadata',
    );
  });
});
