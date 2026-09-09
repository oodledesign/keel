import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { authenticateMcpRequest } from './auth';
import { mcpCorsPreflightResponse, withMcpCors } from './cors';
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
    return withMcpCors(response);
  }

  const [clientStream, drainStream] = response.body.tee();

  void drainStream
    .pipeTo(new WritableStream())
    .catch(() => undefined)
    .finally(onComplete);

  return withMcpCors(
    new Response(clientStream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
  );
}

export function readJsonRpcMethod(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }

  const method = (body as { method?: unknown }).method;
  return typeof method === 'string' ? method : undefined;
}

export function jsonRpcHasId(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return false;
  }

  return 'id' in body && (body as { id?: unknown }).id !== undefined;
}

function logMcpResponse(input: {
  httpMethod: string;
  rpcMethod?: string;
  hasJsonRpcId: boolean;
  status: number;
  contentType: string | null;
}) {
  console.info('[ozer-mcp] request', {
    httpMethod: input.httpMethod,
    rpcMethod: input.rpcMethod ?? null,
    hasJsonRpcId: input.hasJsonRpcId,
    status: input.status,
    contentType: input.contentType,
  });
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return mcpCorsPreflightResponse();
  }

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
      return withMcpCors(new Response('Invalid JSON body', { status: 400 }));
    }
  }

  try {
    const response = await transport.handleRequest(request, { parsedBody });
    const contentType = response.headers.get('content-type') ?? '';

    logMcpResponse({
      httpMethod: request.method,
      rpcMethod: readJsonRpcMethod(parsedBody),
      hasJsonRpcId: jsonRpcHasId(parsedBody),
      status: response.status,
      contentType,
    });

    if (contentType.includes('text/event-stream')) {
      return wrapStreamingResponse(response, () =>
        closeMcpSession(server, transport),
      );
    }

    await closeMcpSession(server, transport);
    return withMcpCors(response);
  } catch (error) {
    console.error('[ozer-mcp] Failed to handle MCP request:', error);
    await closeMcpSession(server, transport);
    return withMcpCors(
      new Response('Error handling MCP request', { status: 500 }),
    );
  }
}
