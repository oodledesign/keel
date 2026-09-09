import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { McpRequestContext } from '../context';

export type OzerMcpToolRegistrar = (
  server: McpServer,
  context: McpRequestContext,
) => void;
