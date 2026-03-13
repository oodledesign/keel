import { describe, expect, it } from 'vitest';

import {
  type KitStatusDeps,
  createKitStatusService,
} from '../kit-status.service';

function createDeps(overrides: Partial<KitStatusDeps> = {}): KitStatusDeps {
  const readJsonMap: Record<string, unknown> = {
    'package.json': {
      name: 'test-project',
      packageManager: 'pnpm@10.0.0',
    },
    'apps/web/package.json': {
      dependencies: {
        next: '16.1.6',
      },
    },
  };

  return {
    rootPath: '/repo',
    async readJsonFile(path: string) {
      if (!(path in readJsonMap)) {
        throw new Error(`missing file: ${path}`);
      }

      return readJsonMap[path];
    },
    async pathExists(path: string) {
      return path === 'apps/web/supabase';
    },
    async isDirectory(path: string) {
      return path === 'node_modules';
    },
    async executeCommand(command: string, args: string[]) {
      if (command !== 'git') {
        throw new Error('unsupported command');
      }

      if (args[0] === 'rev-parse') {
        return {
          stdout: 'main\n',
          stderr: '',
          exitCode: 0,
        };
      }

      if (args[0] === 'status') {
        return {
          stdout: '',
          stderr: '',
          exitCode: 0,
        };
      }

      if (args[0] === 'symbolic-ref') {
        return {
          stdout: 'origin/main\n',
          stderr: '',
          exitCode: 0,
        };
      }

      if (args[0] === 'merge-base') {
        return {
          stdout: 'abc123\n',
          stderr: '',
          exitCode: 0,
        };
      }

      if (args[0] === 'merge-tree') {
        return {
          stdout: '',
          stderr: '',
          exitCode: 0,
        };
      }

      throw new Error('unsupported git args');
    },
    async isPortOpen(port: number) {
      return port === 3000 || port === 54321 || port === 54323;
    },
    getNodeVersion() {
      return 'v22.5.0';
    },
    ...overrides,
  };
}

describe('KitStatusService', () => {
  it('returns a complete status in the happy path', async () => {
    const service = createKitStatusService(createDeps());

    const result = await service.getStatus({});

    expect(result.project_name).toBe('test-project');
    expect(result.package_manager).toBe('pnpm');
    expect(result.node_version).toBe('22.5.0');
    expect(result.git_branch).toBe('main');
    expect(result.git_clean).toBe(true);
    expect(result.deps_installed).toBe(true);
    expect(result.variant).toBe('next-supabase');
    expect(result.services.app.running).toBe(true);
    expect(result.services.app.port).toBe(3000);
    expect(result.services.supabase.running).toBe(true);
    expect(result.services.supabase.api_port).toBe(54321);
    expect(result.services.supabase.studio_port).toBe(54323);
    expect(result.git_modified_files).toHaveLength(0);
    expect(result.git_untracked_files).toHaveLength(0);
    expect(result.git_merge_check.target_branch).toBe('main');
    expect(result.git_merge_check.has_conflicts).toBe(false);
    expect(result.diagnostics).toHaveLength(5);
  });

  it('falls back when git commands fail', async () => {
    const service = createKitStatusService(
      createDeps({
        async executeCommand() {
          throw new Error('git not found');
        },
      }),
    );

    const result = await service.getStatus({});

    expect(result.git_branch).toBe('unknown');
    expect(result.git_clean).toBe(false);
    expect(result.git_merge_check.detectable).toBe(false);
    expect(result.diagnostics.find((item) => item.id === 'git')?.status).toBe(
      'warn',
    );
  });

  it('collects modified files from git status output', async () => {
    const service = createKitStatusService(
      createDeps({
        async executeCommand(command: string, args: string[]) {
          if (command !== 'git') {
            throw new Error('unsupported command');
          }

          if (args[0] === 'rev-parse') {
            return {
              stdout: 'feature/status\n',
              stderr: '',
              exitCode: 0,
            };
          }

          if (args[0] === 'status') {
            return {
              stdout: ' M apps/web/page.tsx\n?? new-file.ts\n',
              stderr: '',
              exitCode: 0,
            };
          }

          if (args[0] === 'symbolic-ref') {
            return {
              stdout: 'origin/main\n',
              stderr: '',
              exitCode: 0,
            };
          }

          if (args[0] === 'merge-base') {
            return {
              stdout: 'abc123\n',
              stderr: '',
              exitCode: 0,
            };
          }

          if (args[0] === 'merge-tree') {
            return {
              stdout: '',
              stderr: '',
              exitCode: 0,
            };
          }

          throw new Error('unsupported git args');
        },
      }),
    );

    const result = await service.getStatus({});

    expect(result.git_clean).toBe(false);
    expect(result.git_modified_files).toEqual(['apps/web/page.tsx']);
    expect(result.git_untracked_files).toEqual(['new-file.ts']);
  });

  it('detects merge conflicts against default branch', async () => {
    const service = createKitStatusService(
      createDeps({
        async executeCommand(command: string, args: string[]) {
          if (command !== 'git') {
            throw new Error('unsupported command');
          }

          if (args[0] === 'rev-parse') {
            return {
              stdout: 'feature/conflicts\n',
              stderr: '',
              exitCode: 0,
            };
          }

          if (args[0] === 'status') {
            return {
              stdout: '',
              stderr: '',
              exitCode: 0,
            };
          }

          if (args[0] === 'symbolic-ref') {
            return {
              stdout: 'origin/main\n',
              stderr: '',
              exitCode: 0,
            };
          }

          if (args[0] === 'merge-base') {
            return {
              stdout: 'abc123\n',
              stderr: '',
              exitCode: 0,
            };
          }

          if (args[0] === 'merge-tree') {
            return {
              stdout:
                'CONFLICT (content): Merge conflict in apps/dev-tool/app/page.tsx\n',
              stderr: '',
              exitCode: 0,
            };
          }

          throw new Error('unsupported git args');
        },
      }),
    );

    const result = await service.getStatus({});

    expect(result.git_merge_check.target_branch).toBe('main');
    expect(result.git_merge_check.detectable).toBe(true);
    expect(result.git_merge_check.has_conflicts).toBe(true);
    expect(result.git_merge_check.conflict_files).toEqual([
      'apps/dev-tool/app/page.tsx',
    ]);
    expect(
      result.diagnostics.find((item) => item.id === 'merge_conflicts')?.status,
    ).toBe('warn');
  });

  it('uses unknown package manager when packageManager is missing', async () => {
    const service = createKitStatusService(
      createDeps({
        async readJsonFile(path: string) {
          if (path === 'package.json') {
            return { name: 'test-project' };
          }

          if (path === 'apps/web/package.json') {
            return {
              dependencies: {
                next: '16.1.6',
              },
            };
          }

          throw new Error(`missing file: ${path}`);
        },
      }),
    );

    const result = await service.getStatus({});

    expect(result.package_manager).toBe('unknown');
  });

  it('provides remedies when services are not running', async () => {
    const service = createKitStatusService(
      createDeps({
        async isPortOpen() {
          return false;
        },
      }),
    );

    const result = await service.getStatus({});

    expect(result.services.app.running).toBe(false);
    expect(result.services.supabase.running).toBe(false);

    const devServerDiagnostic = result.diagnostics.find(
      (item) => item.id === 'dev_server',
    );
    const supabaseDiagnostic = result.diagnostics.find(
      (item) => item.id === 'supabase',
    );

    expect(devServerDiagnostic?.status).toBe('fail');
    expect(devServerDiagnostic?.remedies).toEqual(['Run pnpm dev']);
    expect(supabaseDiagnostic?.status).toBe('fail');
    expect(supabaseDiagnostic?.remedies).toEqual([
      'Run pnpm supabase:web:start',
    ]);
  });

  it('maps variant from .makerkit/config.json when present', async () => {
    const service = createKitStatusService(
      createDeps({
        async pathExists(path: string) {
          return path === '.makerkit/config.json';
        },
        async readJsonFile(path: string) {
          if (path === '.makerkit/config.json') {
            return {
              variant: 'next-prisma',
            };
          }

          if (path === 'package.json') {
            return {
              name: 'test-project',
              packageManager: 'pnpm@10.0.0',
            };
          }

          throw new Error(`missing file: ${path}`);
        },
      }),
    );

    const result = await service.getStatus({});

    expect(result.variant).toBe('next-prisma');
    expect(result.variant_family).toBe('orm');
    expect(result.database).toBe('postgresql');
    expect(result.auth).toBe('better-auth');
  });

  it('reads variant from the template key when present', async () => {
    const service = createKitStatusService(
      createDeps({
        async pathExists(path: string) {
          return path === '.makerkit/config.json';
        },
        async readJsonFile(path: string) {
          if (path === '.makerkit/config.json') {
            return {
              template: 'react-router-supabase',
            };
          }

          if (path === 'package.json') {
            return {
              name: 'test-project',
              packageManager: 'pnpm@10.0.0',
            };
          }

          throw new Error(`missing file: ${path}`);
        },
      }),
    );

    const result = await service.getStatus({});

    expect(result.variant).toBe('react-router-supabase');
    expect(result.framework).toBe('react-router');
  });

  it('reads variant from kitVariant key and preserves unknown names', async () => {
    const service = createKitStatusService(
      createDeps({
        async pathExists(path: string) {
          return path === '.makerkit/config.json';
        },
        async readJsonFile(path: string) {
          if (path === '.makerkit/config.json') {
            return {
              kitVariant: 'custom-enterprise-kit',
            };
          }

          if (path === 'package.json') {
            return {
              name: 'test-project',
              packageManager: 'pnpm@10.0.0',
            };
          }

          throw new Error(`missing file: ${path}`);
        },
      }),
    );

    const result = await service.getStatus({});

    expect(result.variant).toBe('custom-enterprise-kit');
    expect(result.variant_family).toBe('supabase');
    expect(result.framework).toBe('nextjs');
  });

  it('uses heuristic variant fallback when config is absent', async () => {
    const service = createKitStatusService(
      createDeps({
        async pathExists(path: string) {
          return path === 'apps/web/supabase';
        },
      }),
    );

    const result = await service.getStatus({});

    expect(result.variant).toBe('next-supabase');
    expect(result.framework).toBe('nextjs');
    expect(result.database).toBe('supabase');
    expect(result.auth).toBe('supabase');
  });
});
