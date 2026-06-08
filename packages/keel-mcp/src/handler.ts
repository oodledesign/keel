import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import { authenticateMcpRequest } from './auth.js';
import { createSSEBridge, NodeResponseCollector, requestToIncomingMessage } from './http-bridge.js';
import { createKeelMcpServer } from './server.js';
import {
  deleteMcpSession,
  getMcpSession,
  storeMcpSession,
} from './session-store.js';

export const KEEL_MCP_MESSAGES_PATH = '/api/mcp/message';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

export async function handleMcpGet(request: Request): Promise<Response> {
  const auth = await authenticateMcpRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { outgoing, webStream } = createSSEBridge();
  const transport = new SSEServerTransport(KEEL_MCP_MESSAGES_PATH, outgoing);
  const server = createKeelMcpServer(auth.context);

  transport.onclose = () => {
    deleteMcpSession(transport.sessionId);
  };

  storeMcpSession(transport.sessionId, {
    transport,
    context: auth.context,
  });

  try {
    await server.connect(transport);
  } catch (error) {
    deleteMcpSession(transport.sessionId);
    console.error('[keel-mcp] Failed to establish SSE session:', error);
    return new Response('Failed to establish MCP SSE session', { status: 500 });
  }

  request.signal.addEventListener('abort', () => {
    void transport.close();
  });

  return new Response(webStream, {
    headers: SSE_HEADERS,
  });
}

export async function handleMcpPostMessage(request: Request): Promise<Response> {
  const auth = await authenticateMcpRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const sessionId = new URL(request.url).searchParams.get('sessionId')?.trim();
  if (!sessionId) {
    return new Response('Missing sessionId parameter', { status: 400 });
  }

  const session = getMcpSession(sessionId);
  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  if (session.context.userId !== auth.context.userId) {
    return new Response('Forbidden', { status: 403 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const collector = new NodeResponseCollector();
  const incoming = await requestToIncomingMessage(request, parsedBody);

  try {
    await session.transport.handlePostMessage(
      incoming,
      collector.outgoing,
      parsedBody,
    );
  } catch (error) {
    console.error('[keel-mcp] Failed to handle MCP message:', error);
    return new Response('Error handling MCP message', { status: 500 });
  }

  return collector.response;
}

export function createMcpRouteHandlers() {
  return {
    GET: handleMcpGet,
    POST: handleMcpPostMessage,
  };
}
