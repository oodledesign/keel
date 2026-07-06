import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import type { McpRequestContext } from './context';
import { ozerMcpTools } from './tools/index';

export function createOzerMcpServer(context: McpRequestContext): McpServer {
  const server = new McpServer({
    name: 'ozer-mcp',
    version: '0.1.0',
  });

  for (const registerTool of ozerMcpTools) {
    registerTool(server, context);
  }

  return server;
}
