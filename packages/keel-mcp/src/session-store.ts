import type { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';

import type { McpRequestContext } from './context';

export type McpSession = {
  transport: SSEServerTransport;
  context: McpRequestContext;
};

const sessions = new Map<string, McpSession>();

export function storeMcpSession(sessionId: string, session: McpSession): void {
  sessions.set(sessionId, session);
}

export function getMcpSession(sessionId: string): McpSession | undefined {
  return sessions.get(sessionId);
}

export function deleteMcpSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function clearMcpSessions(): void {
  sessions.clear();
}

export function getActiveMcpSessionCount(): number {
  return sessions.size;
}
