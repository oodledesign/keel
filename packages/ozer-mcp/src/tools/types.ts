import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import type { McpRequestContext } from '../context';

export type OzerMcpToolRegistrar = (
  server: McpServer,
  context: McpRequestContext,
) => void;
