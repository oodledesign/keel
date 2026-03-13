import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerComponentsTools } from './tools/components';
import {
  registerDatabaseResources,
  registerDatabaseTools,
} from './tools/database';
import { registerKitDbTools } from './tools/db/index';
import { registerDepsUpgradeAdvisorTool } from './tools/deps-upgrade-advisor/index';
import { registerKitDevTools } from './tools/dev/index';
import { registerKitEmailTemplatesTools } from './tools/emails/index';
import { registerKitEnvTools } from './tools/env/index';
import { registerKitEmailsTools } from './tools/mailbox/index';
import { registerGetMigrationsTools } from './tools/migrations';
import { registerPRDTools } from './tools/prd-manager';
import { registerKitPrerequisitesTool } from './tools/prerequisites/index';
import { registerPromptsSystem } from './tools/prompts';
import { registerRunChecksTool } from './tools/run-checks/index';
import { registerScriptsTools } from './tools/scripts';
import { registerKitStatusTool } from './tools/status/index';
import { registerKitTranslationsTools } from './tools/translations/index';

async function main() {
  // Create server instance
  const server = new McpServer({
    name: 'makerkit',
    version: '1.0.0',
  });

  const transport = new StdioServerTransport();

  registerGetMigrationsTools(server);
  registerKitStatusTool(server);
  registerKitPrerequisitesTool(server);
  registerKitEnvTools(server);
  registerKitDevTools(server);
  registerKitDbTools(server);
  registerKitEmailsTools(server);
  registerKitEmailTemplatesTools(server);
  registerKitTranslationsTools(server);
  registerDatabaseTools(server);
  registerDatabaseResources(server);
  registerComponentsTools(server);
  registerScriptsTools(server);
  registerRunChecksTool(server);
  registerDepsUpgradeAdvisorTool(server);
  registerPRDTools(server);
  registerPromptsSystem(server);

  await server.connect(transport);

  console.error('Makerkit MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
