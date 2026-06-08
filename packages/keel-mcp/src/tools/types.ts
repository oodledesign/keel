import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import type { McpRequestContext } from '../context';

export type KeelMcpToolRegistrar = (
  server: McpServer,
  context: McpRequestContext,
) => void;
