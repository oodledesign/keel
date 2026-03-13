import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execFile } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { Socket } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { type KitDbServiceDeps, createKitDbService } from './kit-db.service';
import {
  KitDbMigrateInputSchema,
  KitDbMigrateOutputSchema,
  KitDbResetInputSchema,
  KitDbResetOutputSchema,
  KitDbSeedInputSchema,
  KitDbSeedOutputSchema,
  KitDbStatusInputSchema,
  KitDbStatusOutputSchema,
} from './schema';

const execFileAsync = promisify(execFile);

type TextContent = {
  type: 'text';
  text: string;
};

export function registerKitDbTools(server: McpServer) {
  const service = createKitDbService(createKitDbDeps());

  server.registerTool(
    'kit_db_status',
    {
      description: 'Check database connectivity and migrations state',
      inputSchema: KitDbStatusInputSchema,
      outputSchema: KitDbStatusOutputSchema,
    },
    async (input) => {
      KitDbStatusInputSchema.parse(input);

      try {
        const result = await service.status();

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_db_status', error);
      }
    },
  );

  server.registerTool(
    'kit_db_migrate',
    {
      description: 'Apply pending database migrations',
      inputSchema: KitDbMigrateInputSchema,
      outputSchema: KitDbMigrateOutputSchema,
    },
    async (input) => {
      try {
        const parsed = KitDbMigrateInputSchema.parse(input);
        const result = await service.migrate(parsed);

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_db_migrate', error);
      }
    },
  );

  server.registerTool(
    'kit_db_seed',
    {
      description: 'Run database seed scripts',
      inputSchema: KitDbSeedInputSchema,
      outputSchema: KitDbSeedOutputSchema,
    },
    async (input) => {
      KitDbSeedInputSchema.parse(input);

      try {
        const result = await service.seed();

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_db_seed', error);
      }
    },
  );

  server.registerTool(
    'kit_db_reset',
    {
      description: 'Reset the database after confirmation',
      inputSchema: KitDbResetInputSchema,
      outputSchema: KitDbResetOutputSchema,
    },
    async (input) => {
      try {
        const parsed = KitDbResetInputSchema.parse(input);
        const result = await service.reset(parsed);

        return {
          structuredContent: result,
          content: buildTextContent(JSON.stringify(result)),
        };
      } catch (error) {
        return buildErrorResponse('kit_db_reset', error);
      }
    },
  );
}

export function createKitDbDeps(rootPath = process.cwd()): KitDbServiceDeps {
  return {
    rootPath,
    async resolveVariantContext() {
      const configuredVariant = await readConfiguredVariant(rootPath);
      if (configuredVariant) {
        return mapVariant(configuredVariant);
      }

      if (await pathExists(join(rootPath, 'apps', 'web', 'supabase'))) {
        return mapVariant('next-supabase');
      }

      const webPackage = await readJsonIfPresent(
        join(rootPath, 'apps', 'web', 'package.json'),
      );
      const dependencies = {
        ...(webPackage?.dependencies ?? {}),
        ...(webPackage?.devDependencies ?? {}),
      } as Record<string, unknown>;

      if ('prisma' in dependencies || '@prisma/client' in dependencies) {
        return mapVariant('next-prisma');
      }

      if ('drizzle-kit' in dependencies || 'drizzle-orm' in dependencies) {
        return mapVariant('next-drizzle');
      }

      return mapVariant('next-supabase');
    },
    async executeCommand(command: string, args: string[]) {
      const result = await executeWithFallback(rootPath, command, args);

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
      };
    },
    async isPortOpen(port: number) {
      return checkPort(port);
    },
    async fileExists(path: string) {
      return pathExists(path);
    },
    async readdir(path: string) {
      return readdir(path);
    },
    async readJsonFile(path: string) {
      const raw = await readFile(path, 'utf8');
      return JSON.parse(raw) as unknown;
    },
  };
}

function mapVariant(variant: string) {
  if (variant === 'next-prisma') {
    return {
      variant,
      variantFamily: 'orm',
      tool: 'prisma',
    } as const;
  }

  if (variant === 'next-drizzle') {
    return {
      variant,
      variantFamily: 'orm',
      tool: 'drizzle-kit',
    } as const;
  }

  if (variant === 'react-router-supabase') {
    return {
      variant,
      variantFamily: 'supabase',
      tool: 'supabase',
    } as const;
  }

  return {
    variant: variant.includes('prisma') ? variant : 'next-supabase',
    variantFamily: 'supabase',
    tool: 'supabase',
  } as const;
}

async function readConfiguredVariant(rootPath: string) {
  const configPath = join(rootPath, '.makerkit', 'config.json');

  try {
    await access(configPath);
    const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<
      string,
      unknown
    >;

    return (
      readString(config, 'variant') ??
      readString(config, 'template') ??
      readString(config, 'kitVariant')
    );
  } catch {
    return null;
  }
}

function readString(obj: Record<string, unknown>, key: string) {
  const value = obj[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function executeWithFallback(
  rootPath: string,
  command: string,
  args: string[],
) {
  try {
    return await execFileAsync(command, args, {
      cwd: rootPath,
    });
  } catch (error) {
    if (isLocalCliCandidate(command)) {
      const localBinCandidates = [
        join(rootPath, 'node_modules', '.bin', command),
        join(rootPath, 'apps', 'web', 'node_modules', '.bin', command),
      ];

      for (const localBin of localBinCandidates) {
        try {
          return await execFileAsync(localBin, args, {
            cwd: rootPath,
          });
        } catch {
          // Try next local binary candidate.
        }
      }

      try {
        return await execFileAsync('pnpm', ['exec', command, ...args], {
          cwd: rootPath,
        });
      } catch {
        return execFileAsync(
          'pnpm',
          ['--filter', 'web', 'exec', command, ...args],
          {
            cwd: rootPath,
          },
        );
      }
    }

    if (command === 'pnpm' || command === 'docker') {
      return execFileAsync(command, args, {
        cwd: rootPath,
      });
    }

    throw error;
  }
}

function isLocalCliCandidate(command: string) {
  return (
    command === 'supabase' || command === 'drizzle-kit' || command === 'prisma'
  );
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfPresent(path: string) {
  try {
    const content = await readFile(path, 'utf8');
    return JSON.parse(content) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };
  } catch {
    return null;
  }
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
    structuredContent: {
      error: {
        message,
      },
    },
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

export { createKitDbService } from './kit-db.service';
export type { KitDbServiceDeps } from './kit-db.service';
export type { KitDbStatusOutput } from './schema';
