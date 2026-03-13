import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  type KitTranslationsDeps,
  createKitTranslationsDeps,
  createKitTranslationsService,
} from './kit-translations.service';
import {
  KitTranslationsAddLocaleInputSchema,
  KitTranslationsAddLocaleOutputSchema,
  KitTranslationsAddNamespaceInputSchema,
  KitTranslationsAddNamespaceOutputSchema,
  KitTranslationsListInputSchema,
  KitTranslationsListOutputSchema,
  KitTranslationsRemoveLocaleInputSchema,
  KitTranslationsRemoveLocaleOutputSchema,
  KitTranslationsRemoveNamespaceInputSchema,
  KitTranslationsRemoveNamespaceOutputSchema,
  KitTranslationsStatsInputSchema,
  KitTranslationsStatsOutputSchema,
  KitTranslationsUpdateInputSchema,
  KitTranslationsUpdateOutputSchema,
} from './schema';

type TextContent = {
  type: 'text';
  text: string;
};

export function registerKitTranslationsTools(server: McpServer) {
  const service = createKitTranslationsService(createKitTranslationsDeps());

  server.registerTool(
    'kit_translations_list',
    {
      description: 'List translations across locales and namespaces',
      inputSchema: KitTranslationsListInputSchema,
      outputSchema: KitTranslationsListOutputSchema,
    },
    async () => {
      try {
        const result = await service.list();

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_translations_list', error);
      }
    },
  );

  server.registerTool(
    'kit_translations_update',
    {
      description: 'Update a translation value in a locale namespace',
      inputSchema: KitTranslationsUpdateInputSchema,
      outputSchema: KitTranslationsUpdateOutputSchema,
    },
    async (input) => {
      try {
        const parsed = KitTranslationsUpdateInputSchema.parse(input);
        const result = await service.update(parsed);

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_translations_update', error);
      }
    },
  );

  server.registerTool(
    'kit_translations_stats',
    {
      description: 'Get translation coverage statistics',
      inputSchema: KitTranslationsStatsInputSchema,
      outputSchema: KitTranslationsStatsOutputSchema,
    },
    async () => {
      try {
        const result = await service.stats();

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_translations_stats', error);
      }
    },
  );

  server.registerTool(
    'kit_translations_add_namespace',
    {
      description: 'Create a new translation namespace across all locales',
      inputSchema: KitTranslationsAddNamespaceInputSchema,
      outputSchema: KitTranslationsAddNamespaceOutputSchema,
    },
    async (input) => {
      try {
        const { namespace } =
          KitTranslationsAddNamespaceInputSchema.parse(input);
        const result = await service.addNamespace({ namespace });

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_translations_add_namespace', error);
      }
    },
  );

  server.registerTool(
    'kit_translations_add_locale',
    {
      description: 'Add a new locale with empty namespace files',
      inputSchema: KitTranslationsAddLocaleInputSchema,
      outputSchema: KitTranslationsAddLocaleOutputSchema,
    },
    async (input) => {
      try {
        const { locale } = KitTranslationsAddLocaleInputSchema.parse(input);
        const result = await service.addLocale({ locale });

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_translations_add_locale', error);
      }
    },
  );

  server.registerTool(
    'kit_translations_remove_namespace',
    {
      description: 'Remove a translation namespace from all locales',
      inputSchema: KitTranslationsRemoveNamespaceInputSchema,
      outputSchema: KitTranslationsRemoveNamespaceOutputSchema,
    },
    async (input) => {
      try {
        const { namespace } =
          KitTranslationsRemoveNamespaceInputSchema.parse(input);
        const result = await service.removeNamespace({ namespace });

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_translations_remove_namespace', error);
      }
    },
  );

  server.registerTool(
    'kit_translations_remove_locale',
    {
      description: 'Remove a locale and all its translation files',
      inputSchema: KitTranslationsRemoveLocaleInputSchema,
      outputSchema: KitTranslationsRemoveLocaleOutputSchema,
    },
    async (input) => {
      try {
        const { locale } = KitTranslationsRemoveLocaleInputSchema.parse(input);
        const result = await service.removeLocale({ locale });

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_translations_remove_locale', error);
      }
    },
  );
}

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

export { createKitTranslationsService, createKitTranslationsDeps };
export type { KitTranslationsDeps };
export type {
  KitTranslationsAddLocaleOutput,
  KitTranslationsAddNamespaceOutput,
  KitTranslationsListOutput,
  KitTranslationsRemoveLocaleOutput,
  KitTranslationsRemoveNamespaceOutput,
  KitTranslationsStatsOutput,
  KitTranslationsUpdateOutput,
} from './schema';
