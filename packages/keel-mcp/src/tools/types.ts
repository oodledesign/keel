import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { McpRequestContext } from '../context.js';

export type KeelMcpToolRegistrar = (
  server: McpServer,
  context: McpRequestContext,
) => void;
