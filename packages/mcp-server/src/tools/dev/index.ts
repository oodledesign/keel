import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execFile, spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { Socket } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  DEFAULT_PORT_CONFIG,
  type KitDevServiceDeps,
  createKitDevService,
} from './kit-dev.service';
import {
  KitDevStartInputSchema,
  KitDevStartOutputSchema,
  KitDevStatusInputSchema,
  KitDevStatusOutputSchema,
  KitDevStopInputSchema,
  KitDevStopOutputSchema,
  KitMailboxStatusInputSchema,
  KitMailboxStatusOutputSchema,
} from './schema';

const execFileAsync = promisify(execFile);

export function registerKitDevTools(server: McpServer) {
  const service = createKitDevService(createKitDevDeps());

  server.registerTool(
    'kit_dev_start',
    {
      description: 'Start all or selected local development services',
      inputSchema: KitDevStartInputSchema,
      outputSchema: KitDevStartOutputSchema,
    },
    async (input) => {
      const parsedInput = KitDevStartInputSchema.parse(input);

      try {
        const result = await service.start(parsedInput);

        return {
          structuredContent: result,
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `kit_dev_start failed: ${toErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    'kit_dev_stop',
    {
      description: 'Stop all or selected local development services',
      inputSchema: KitDevStopInputSchema,
      outputSchema: KitDevStopOutputSchema,
    },
    async (input) => {
      const parsedInput = KitDevStopInputSchema.parse(input);

      try {
        const result = await service.stop(parsedInput);

        return {
          structuredContent: result,
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `kit_dev_stop failed: ${toErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    'kit_dev_status',
    {
      description:
        'Check status for app, database, mailbox, and stripe local services',
      inputSchema: KitDevStatusInputSchema,
      outputSchema: KitDevStatusOutputSchema,
    },
    async (input) => {
      KitDevStatusInputSchema.parse(input);

      try {
        const result = await service.status();

        return {
          structuredContent: result,
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `kit_dev_status failed: ${toErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    'kit_mailbox_status',
    {
      description:
        'Check local mailbox health with graceful fallback fields for UI state',
      inputSchema: KitMailboxStatusInputSchema,
      outputSchema: KitMailboxStatusOutputSchema,
    },
    async (input) => {
      KitMailboxStatusInputSchema.parse(input);

      try {
        const result = await service.mailboxStatus();

        return {
          structuredContent: result,
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `kit_mailbox_status failed: ${toErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}

export function createKitDevDeps(rootPath = process.cwd()): KitDevServiceDeps {
  return {
    rootPath,
    async resolveVariantContext() {
      const packageJson = await readJsonIfPresent(
        join(rootPath, 'apps', 'web', 'package.json'),
      );
      const hasSupabase = await pathExists(
        join(rootPath, 'apps', 'web', 'supabase'),
      );

      const dependencies = {
        ...(packageJson?.dependencies ?? {}),
        ...(packageJson?.devDependencies ?? {}),
      } as Record<string, unknown>;

      const framework =
        'react-router' in dependencies || '@react-router/dev' in dependencies
          ? 'react-router'
          : 'nextjs';

      if (hasSupabase) {
        return {
          variant:
            framework === 'react-router'
              ? 'react-router-supabase'
              : 'next-supabase',
          variantFamily: 'supabase',
          framework,
        } as const;
      }

      return {
        variant:
          framework === 'react-router'
            ? 'react-router-drizzle'
            : 'next-drizzle',
        variantFamily: 'orm',
        framework,
      } as const;
    },
    async resolvePortConfig() {
      const configTomlPath = join(
        rootPath,
        'apps',
        'web',
        'supabase',
        'config.toml',
      );

      let supabaseApiPort = DEFAULT_PORT_CONFIG.supabaseApiPort;
      let supabaseStudioPort = DEFAULT_PORT_CONFIG.supabaseStudioPort;

      try {
        const toml = await readFile(configTomlPath, 'utf8');
        supabaseApiPort = parseTomlSectionPort(toml, 'api') ?? supabaseApiPort;
        supabaseStudioPort =
          parseTomlSectionPort(toml, 'studio') ?? supabaseStudioPort;
      } catch {
        // config.toml not present or unreadable — use defaults.
      }

      return {
        appPort: DEFAULT_PORT_CONFIG.appPort,
        supabaseApiPort,
        supabaseStudioPort,
        mailboxApiPort: DEFAULT_PORT_CONFIG.mailboxApiPort,
        mailboxPort: DEFAULT_PORT_CONFIG.mailboxPort,
        ormDbPort: DEFAULT_PORT_CONFIG.ormDbPort,
        stripeWebhookPath: DEFAULT_PORT_CONFIG.stripeWebhookPath,
      };
    },
    async executeCommand(command: string, args: string[]) {
      const result = await executeWithFallback(rootPath, command, args);

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
      };
    },
    async spawnDetached(command: string, args: string[]) {
      const child = spawn(command, args, {
        cwd: rootPath,
        detached: true,
        stdio: 'ignore',
      });

      child.unref();

      if (!child.pid) {
        throw new Error(`Failed to spawn ${command}`);
      }

      return {
        pid: child.pid,
      };
    },
    async isPortOpen(port: number) {
      return checkPort(port);
    },
    async fetchJson(url: string) {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return response.json();
    },
    async getPortProcess(port: number) {
      try {
        const result = await execFileAsync(
          'lsof',
          ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc'],
          {
            cwd: rootPath,
          },
        );

        const pidLine = result.stdout
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line.startsWith('p'));

        const commandLine = result.stdout
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line.startsWith('c'));

        if (!pidLine || !commandLine) {
          return null;
        }

        const pid = Number(pidLine.slice(1));

        if (!Number.isFinite(pid)) {
          return null;
        }

        return {
          pid,
          command: commandLine.slice(1),
        };
      } catch {
        return null;
      }
    },
    async isProcessRunning(pid: number) {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    },
    async findProcessesByName(pattern: string) {
      try {
        const result = await execFileAsync('pgrep', ['-fl', pattern], {
          cwd: rootPath,
        });

        return result.stdout
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const spaceIdx = line.indexOf(' ');

            if (spaceIdx <= 0) {
              return null;
            }

            const pid = Number(line.slice(0, spaceIdx));
            const command = line.slice(spaceIdx + 1).trim();

            if (!Number.isFinite(pid)) {
              return null;
            }

            return { pid, command };
          })
          .filter((p): p is { pid: number; command: string } => p !== null);
      } catch {
        return [];
      }
    },
    async killProcess(pid: number, signal = 'SIGTERM') {
      try {
        // Kill the entire process group (negative PID) since services
        // are spawned detached and become process group leaders.
        process.kill(-pid, signal);
      } catch {
        // Fall back to killing the individual process if group kill fails.
        process.kill(pid, signal);
      }
    },
    async sleep(ms: number) {
      await new Promise((resolve) => setTimeout(resolve, ms));
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

    throw error;
  }
}

function isLocalCliCandidate(command: string) {
  return command === 'supabase' || command === 'stripe';
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

function parseTomlSectionPort(
  content: string,
  section: string,
): number | undefined {
  const lines = content.split('\n');
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('[')) {
      inSection = trimmed === `[${section}]`;
      continue;
    }

    if (inSection) {
      const match = trimmed.match(/^port\s*=\s*(\d+)/);

      if (match) {
        return Number(match[1]);
      }
    }
  }

  return undefined;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

export { createKitDevService, DEFAULT_PORT_CONFIG } from './kit-dev.service';
export type { KitDevServiceDeps, PortConfig } from './kit-dev.service';
export type {
  KitDevStartOutput,
  KitDevStatusOutput,
  KitDevStopOutput,
} from './schema';
