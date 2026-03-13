import { execFile } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import { Socket } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  type KitStatusDeps,
  createKitStatusService,
} from '@kit/mcp-server/status';

const execFileAsync = promisify(execFile);

export async function loadDashboardKitStatus() {
  const rootPath = await findWorkspaceRoot(process.cwd());
  const service = createKitStatusService(createKitStatusDeps(rootPath));
  return service.getStatus({});
}

function createKitStatusDeps(rootPath: string): KitStatusDeps {
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
