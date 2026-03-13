import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execFile } from 'node:child_process';
import { Socket } from 'node:net';
import { promisify } from 'node:util';

import {
  type KitMailboxDeps,
  createKitMailboxService,
} from './kit-mailbox.service';
import {
  KitEmailsListInputSchema,
  KitEmailsListOutputSchema,
  KitEmailsReadInputSchema,
  KitEmailsReadOutputSchema,
  KitEmailsSetReadStatusInputSchema,
  KitEmailsSetReadStatusOutputSchema,
} from './schema';

const execFileAsync = promisify(execFile);

type TextContent = {
  type: 'text';
  text: string;
};

export function registerKitEmailsTools(server: McpServer) {
  const service = createKitMailboxService(createKitMailboxDeps());

  server.registerTool(
    'kit_emails_list',
    {
      description:
        'List received emails from the local Mailpit inbox (runtime mailbox, not source templates)',
      inputSchema: KitEmailsListInputSchema,
      outputSchema: KitEmailsListOutputSchema,
    },
    async (input) => {
      try {
        const parsed = KitEmailsListInputSchema.parse(input);
        const result = await service.list(parsed);

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_emails_list', error);
      }
    },
  );

  server.registerTool(
    'kit_emails_read',
    {
      description:
        'Read a received email from the local Mailpit inbox by message id (includes text/html/headers)',
      inputSchema: KitEmailsReadInputSchema,
      outputSchema: KitEmailsReadOutputSchema,
    },
    async (input) => {
      try {
        const parsed = KitEmailsReadInputSchema.parse(input);
        const result = await service.read(parsed);

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_emails_read', error);
      }
    },
  );

  server.registerTool(
    'kit_emails_set_read_status',
    {
      description:
        'Set read/unread status for a received email in the local Mailpit inbox',
      inputSchema: KitEmailsSetReadStatusInputSchema,
      outputSchema: KitEmailsSetReadStatusOutputSchema,
    },
    async (input) => {
      try {
        const parsed = KitEmailsSetReadStatusInputSchema.parse(input);
        const result = await service.setReadStatus(parsed);

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_emails_set_read_status', error);
      }
    },
  );
}

export function createKitMailboxDeps(rootPath = process.cwd()): KitMailboxDeps {
  return {
    async executeCommand(command: string, args: string[]) {
      const result = await execFileAsync(command, args, { cwd: rootPath });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
      };
    },
    async isPortOpen(port: number) {
      return checkPort(port);
    },
    async fetchJson(url: string) {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Mailpit API request failed with status ${response.status}`,
        );
      }

      return response.json();
    },
    async requestJson(url: string, init) {
      const response = await fetch(url, {
        method: init?.method ?? 'GET',
        headers: init?.headers,
        body: init?.body,
      });

      if (!response.ok) {
        throw new Error(
          `Mailpit API request failed with status ${response.status}`,
        );
      }

      return response.json();
    },
  };
}

async function checkPort(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = new Socket();

    socket.setTimeout(200);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, '127.0.0.1');
  });
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

export { createKitMailboxService } from './kit-mailbox.service';
export type { KitMailboxDeps } from './kit-mailbox.service';
export type {
  KitEmailsListOutput,
  KitEmailsReadOutput,
  KitEmailsSetReadStatusOutput,
} from './schema';
