import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execFile } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import { Socket } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  type KitStatusDeps,
  createKitStatusService,
} from './kit-status.service';
import { KitStatusInputSchema, KitStatusOutputSchema } from './schema';

const execFileAsync = promisify(execFile);

export function registerKitStatusTool(server: McpServer) {
  return server.registerTool(
    'kit_status',
    {
      description: 'Project status with variant context',
      inputSchema: KitStatusInputSchema,
      outputSchema: KitStatusOutputSchema,
    },
    async (input) => {
      const parsedInput = KitStatusInputSchema.parse(input);

      try {
        const service = createKitStatusService(createKitStatusDeps());
        const status = await service.getStatus(parsedInput);

        return {
          structuredContent: status,
          content: [
            {
              type: 'text',
              text: JSON.stringify(status),
            },
          ],
        };
      } catch (error) {
        const message = toErrorMessage(error);

        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `kit_status failed: ${message}`,
            },
          ],
        };
      }
    },
  );
}

function createKitStatusDeps(): KitStatusDeps {
  const rootPath = process.cwd();

  return {
    rootPath,
    async readJsonFile(path: string): Promise<unknown> {
      const filePath = join(rootPath, path);
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content) as unknown;
    },
    async pathExists(path: string) {
      const fullPath = join(rootPath, path);

      try {
        await access(fullPath);
        return true;
      } catch {
        return false;
      }
    },
    async isDirectory(path: string) {
      const fullPath = join(rootPath, path);

      try {
        const stats = await stat(fullPath);
        return stats.isDirectory();
      } catch {
        return false;
      }
    },
    async executeCommand(command: string, args: string[]) {
      const result = await execFileAsync(command, args, {
        cwd: rootPath,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
      };
    },
    async isPortOpen(port: number) {
      return checkPort(port);
    },
    getNodeVersion() {
      return process.version;
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

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

export {
  createKitStatusService,
  type KitStatusDeps,
} from './kit-status.service';
export type { KitStatusOutput } from './schema';
