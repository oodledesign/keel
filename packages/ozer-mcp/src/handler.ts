import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { authenticateMcpRequest } from './auth';
import { createKeelMcpServer } from './server';

export async function handleMcpRequest(request: Request): Promise<Response> {
  const auth = await authenticateMcpRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createKeelMcpServer(auth.context);

  await server.connect(transport);

  try {
    let parsedBody: unknown;

    if (request.method === 'POST') {
      try {
        parsedBody = await request.clone().json();
      } catch {
        return new Response('Invalid JSON body', { status: 400 });
      }
    }

    return await transport.handleRequest(request, { parsedBody });
  } catch (error) {
    console.error('[keel-mcp] Failed to handle MCP request:', error);
    return new Response('Error handling MCP request', { status: 500 });
  } finally {
    await server.close();
    await transport.close();
  }
}
