import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { authenticateMcpRequest } from './auth';
import { createOzerMcpServer } from './server';

async function closeMcpSession(
  server: ReturnType<typeof createOzerMcpServer>,
  transport: WebStandardStreamableHTTPServerTransport,
) {
  await server.close();
  await transport.close();
}

function wrapStreamingResponse(
  response: Response,
  onComplete: () => Promise<void>,
): Response {
  if (!response.body) {
    void onComplete();
    return response;
  }

  const [clientStream, drainStream] = response.body.tee();

  void drainStream
    .pipeTo(new WritableStream())
    .catch(() => undefined)
    .finally(onComplete);

  return new Response(clientStream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const auth = await authenticateMcpRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // Serverless: return a complete JSON-RPC body per request. The default SSE
    // stream was being torn down in finally before the client could read it.
    enableJsonResponse: true,
  });
  const server = createOzerMcpServer(auth.context);

  await server.connect(transport);

  let parsedBody: unknown;

  if (request.method === 'POST') {
    try {
      parsedBody = await request.clone().json();
    } catch {
      await closeMcpSession(server, transport);
      return new Response('Invalid JSON body', { status: 400 });
    }
  }

  try {
    const response = await transport.handleRequest(request, { parsedBody });
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('text/event-stream')) {
      return wrapStreamingResponse(response, () =>
        closeMcpSession(server, transport),
      );
    }

    await closeMcpSession(server, transport);
    return response;
  } catch (error) {
    console.error('[ozer-mcp] Failed to handle MCP request:', error);
    await closeMcpSession(server, transport);
    return new Response('Error handling MCP request', { status: 500 });
  }
}
