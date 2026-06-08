import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import type { McpRequestContext } from './context';
import { keelMcpTools } from './tools/index';

export function createKeelMcpServer(context: McpRequestContext): McpServer {
  const server = new McpServer({
    name: 'keel-mcp',
    version: '0.1.0',
  });

  for (const registerTool of keelMcpTools) {
    registerTool(server, context);
  }

  return server;
}
