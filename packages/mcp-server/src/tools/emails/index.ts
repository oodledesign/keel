import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  type KitEmailsDeps,
  createKitEmailsDeps,
  createKitEmailsService,
} from './kit-emails.service';
import {
  KitEmailsListInputSchema,
  KitEmailsListOutputSchema,
  KitEmailsReadInputSchema,
  KitEmailsReadOutputSchema,
} from './schema';

type TextContent = {
  type: 'text';
  text: string;
};

export function registerKitEmailTemplatesTools(server: McpServer) {
  const service = createKitEmailsService(createKitEmailsDeps());

  server.registerTool(
    'kit_email_templates_list',
    {
      description:
        'List project email template files (React Email + Supabase auth templates), not received inbox messages',
      inputSchema: KitEmailsListInputSchema,
      outputSchema: KitEmailsListOutputSchema,
    },
    async () => {
      try {
        const result = await service.list();

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_email_templates_list', error);
      }
    },
  );

  server.registerTool(
    'kit_email_templates_read',
    {
      description:
        'Read a project email template source file by template id, with extracted props and optional rendered HTML sample',
      inputSchema: KitEmailsReadInputSchema,
      outputSchema: KitEmailsReadOutputSchema,
    },
    async (input) => {
      try {
        const { id } = KitEmailsReadInputSchema.parse(input);
        const result = await service.read({ id });

        const content: TextContent[] = [];

        // Return source, props, and metadata
        const { renderedHtml, ...metadata } = result;

        content.push({ type: 'text', text: JSON.stringify(metadata) });

        // Include rendered HTML as a separate content block
        if (renderedHtml) {
          content.push({
            type: 'text',
            text: `\n\n--- Rendered HTML ---\n\n${renderedHtml}`,
          });
        }

        return {
          structuredContent: result,
          content,
        };
      } catch (error) {
        return buildErrorResponse('kit_email_templates_read', error);
      }
    },
  );
}

export const registerKitEmailsTools = registerKitEmailTemplatesTools;

function buildErrorResponse(tool: string, error: unknown) {
  const message = `${tool} failed: ${toErrorMessage(error)}`;

  return {
    isError: true,
    content: buildTextContent(message),
  };
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

function buildTextContent(text: string): TextContent[] {
  return [{ type: 'text', text }];
}

export { createKitEmailsService, createKitEmailsDeps };
export type { KitEmailsDeps };
export type { KitEmailsListOutput, KitEmailsReadOutput } from './schema';
