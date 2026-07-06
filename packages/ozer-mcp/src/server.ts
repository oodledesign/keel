import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { getMcpConnectorIconUrl } from './config';
import type { McpRequestContext } from './context';
import { ozerMcpTools } from './tools/index';

export function createOzerMcpServer(context: McpRequestContext): McpServer {
  const server = new McpServer({
    name: 'ozer-mcp',
    title: 'Ozer',
    version: '0.1.0',
    icons: [
      {
        src: getMcpConnectorIconUrl(),
        mimeType: 'image/svg+xml',
        sizes: ['64x64', '128x128', '512x512'],
        theme: 'light',
      },
    ],
  });

  for (const registerTool of ozerMcpTools) {
    registerTool(server, context);
  }

  return server;
}
