import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  type KitPrerequisitesDeps,
  createKitPrerequisitesService,
} from '@kit/mcp-server/prerequisites';

const execFileAsync = promisify(execFile);

export async function loadDashboardKitPrerequisites() {
  const rootPath = await findWorkspaceRoot(process.cwd());
  const service = createKitPrerequisitesService(
    createKitPrerequisitesDeps(rootPath),
  );
  return service.check({});
}

function createKitPrerequisitesDeps(rootPath: string): KitPrerequisitesDeps {
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

async function findWorkspaceRoot(startPath: string) {
  let current = startPath;

  for (let depth = 0; depth < 6; depth++) {
    const workspaceManifest = join(current, 'pnpm-workspace.yaml');

    try {
      await access(workspaceManifest);
      return current;
    } catch {
      // Continue to parent path.
    }

    const parent = join(current, '..');

    if (parent === current) {
      break;
    }

    current = parent;
  }

  return startPath;
}
