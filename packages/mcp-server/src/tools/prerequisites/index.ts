import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  type KitPrerequisitesDeps,
  createKitPrerequisitesService,
} from './kit-prerequisites.service';
import {
  KitPrerequisitesInputSchema,
  KitPrerequisitesOutputSchema,
} from './schema';

const execFileAsync = promisify(execFile);

export function registerKitPrerequisitesTool(server: McpServer) {
  return server.registerTool(
    'kit_prerequisites',
    {
      description: 'Check installed tools and versions for this kit variant',
      inputSchema: KitPrerequisitesInputSchema,
      outputSchema: KitPrerequisitesOutputSchema,
    },
    async (input) => {
      const parsedInput = KitPrerequisitesInputSchema.parse(input);

      try {
        const service = createKitPrerequisitesService(
          createKitPrerequisitesDeps(),
        );

        const result = await service.check(parsedInput);

        return {
          structuredContent: result,
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `kit_prerequisites failed: ${toErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}

function createKitPrerequisitesDeps(): KitPrerequisitesDeps {
  const rootPath = process.cwd();

  return {
    async getVariantFamily() {
      const variant = await resolveVariant(rootPath);
      return variant.includes('supabase') ? 'supabase' : 'orm';
    },
    async executeCommand(command: string, args: string[]) {
      const result = await executeWithFallback(rootPath, command, args);

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
      };
    },
  };
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
    // Local CLI tools are often installed in node_modules/.bin in this monorepo.
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

    if (command === 'pnpm') {
      return execFileAsync(command, args, {
        cwd: rootPath,
      });
    }

    throw error;
  }
}

function isLocalCliCandidate(command: string) {
  return command === 'supabase' || command === 'stripe';
}

async function resolveVariant(rootPath: string) {
  const configPath = join(rootPath, '.makerkit', 'config.json');

  try {
    await access(configPath);
    const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<
      string,
      unknown
    >;

    const variant =
      readString(config, 'variant') ??
      readString(config, 'template') ??
      readString(config, 'kitVariant');

    if (variant) {
      return variant;
    }
  } catch {
    // Fall through to heuristic.
  }

  if (await pathExists(join(rootPath, 'apps', 'web', 'supabase'))) {
    return 'next-supabase';
  }

  return 'next-drizzle';
}

function readString(obj: Record<string, unknown>, key: string) {
  const value = obj[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

export {
  createKitPrerequisitesService,
  type KitPrerequisitesDeps,
} from './kit-prerequisites.service';
export type { KitPrerequisitesOutput } from './schema';
