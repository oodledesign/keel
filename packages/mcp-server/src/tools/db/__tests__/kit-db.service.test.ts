import { describe, expect, it, vi } from 'vitest';

import { type KitDbServiceDeps, createKitDbService } from '../kit-db.service';

function createDeps(
  overrides: Partial<KitDbServiceDeps> = {},
): KitDbServiceDeps {
  return {
    rootPath: '/repo',
    async resolveVariantContext() {
      return {
        variant: 'next-supabase',
        variantFamily: 'supabase',
        tool: 'supabase',
      };
    },
    async executeCommand() {
      return { stdout: '', stderr: '', exitCode: 0 };
    },
    async isPortOpen() {
      return false;
    },
    async fileExists() {
      return false;
    },
    async readdir() {
      return [];
    },
    async readJsonFile() {
      return {};
    },
    ...overrides,
  };
}

describe('KitDbService.status', () => {
  it('reports pending migrations when CLI output is unavailable', async () => {
    const deps = createDeps({
      async fileExists(path: string) {
        return path.includes('supabase/migrations');
      },
      async readdir() {
        return ['20260101010101_create_table.sql'];
      },
      async executeCommand() {
        throw new Error('supabase missing');
      },
    });

    const service = createKitDbService(deps);
    const result = await service.status();

    expect(result.migrations.pending).toBe(1);
    expect(result.migrations.pending_names).toEqual([
      '20260101010101_create_table',
    ]);
  });

  it('treats local migrations as applied when connected', async () => {
    const deps = createDeps({
      async fileExists(path: string) {
        return path.includes('supabase/migrations');
      },
      async readdir() {
        return ['20260101010101_create_table.sql'];
      },
      async executeCommand() {
        throw new Error('supabase missing');
      },
      async isPortOpen() {
        return true;
      },
    });

    const service = createKitDbService(deps);
    const result = await service.status();

    expect(result.migrations.applied).toBe(1);
    expect(result.migrations.pending).toBe(0);
  });

  it('parses supabase migrations list output', async () => {
    const deps = createDeps({
      async executeCommand(command, args) {
        if (command === 'supabase' && args.join(' ') === 'migrations list') {
          return {
            stdout:
              '20260101010101_create_table | applied\n20260202020202_add_billing | not applied\n',
            stderr: '',
            exitCode: 0,
          };
        }

        return { stdout: '', stderr: '', exitCode: 0 };
      },
    });

    const service = createKitDbService(deps);
    const result = await service.status();

    expect(result.migrations.applied).toBe(1);
    expect(result.migrations.pending).toBe(1);
    expect(result.migrations.pending_names).toEqual([
      '20260202020202_add_billing',
    ]);
  });

  it('maps id/name columns to local migration names', async () => {
    const deps = createDeps({
      async fileExists(path: string) {
        return path.includes('supabase/migrations');
      },
      async readdir() {
        return ['20240319163440_roles-seed.sql'];
      },
      async executeCommand(command, args) {
        if (command === 'supabase' && args.join(' ') === 'migrations list') {
          return {
            stdout:
              '20240319163440 | roles-seed | Applied\n20240401010101 | add-billing | Pending\n',
            stderr: '',
            exitCode: 0,
          };
        }

        return { stdout: '', stderr: '', exitCode: 0 };
      },
    });

    const service = createKitDbService(deps);
    const result = await service.status();

    expect(result.migrations.applied).toBe(1);
    expect(result.migrations.pending).toBe(1);
    expect(result.migrations.pending_names).toEqual([
      '20240401010101_add-billing',
    ]);
  });

  it('treats id/name list with no status as applied', async () => {
    const deps = createDeps({
      async fileExists(path: string) {
        return path.includes('supabase/migrations');
      },
      async readdir() {
        return [
          '20240319163440_roles-seed.sql',
          '20240401010101_add-billing.sql',
        ];
      },
      async executeCommand(command, args) {
        if (command === 'supabase' && args.join(' ') === 'migrations list') {
          return {
            stdout:
              '20240319163440 | roles-seed\n20240401010101 | add-billing\n',
            stderr: '',
            exitCode: 0,
          };
        }

        return { stdout: '', stderr: '', exitCode: 0 };
      },
    });

    const service = createKitDbService(deps);
    const result = await service.status();

    expect(result.migrations.applied).toBe(2);
    expect(result.migrations.pending).toBe(0);
  });
});

describe('KitDbService.migrate', () => {
  it('throws when target is not latest', async () => {
    const service = createKitDbService(createDeps());

    await expect(
      service.migrate({ target: '20260101010101_create_table' }),
    ).rejects.toThrow(/target "latest"/);
  });

  it('returns applied migrations from pending list', async () => {
    const deps = createDeps({
      async fileExists(path: string) {
        return path.includes('supabase/migrations');
      },
      async readdir() {
        return ['20260101010101_create_table.sql'];
      },
      async executeCommand(command, args) {
        if (command === 'supabase' && args.join(' ') === 'migrations list') {
          return {
            stdout: '20260101010101_create_table | pending\n',
            stderr: '',
            exitCode: 0,
          };
        }

        return { stdout: '', stderr: '', exitCode: 0 };
      },
    });

    const service = createKitDbService(deps);
    const result = await service.migrate({ target: 'latest' });

    expect(result.applied).toEqual(['20260101010101_create_table']);
    expect(result.total_applied).toBe(1);
  });
});

describe('KitDbService.reset', () => {
  it('requires confirm true', async () => {
    const service = createKitDbService(createDeps());

    await expect(service.reset({ confirm: false })).rejects.toThrow(
      /confirm: true/,
    );
  });
});

describe('KitDbService.seed', () => {
  it('uses db:seed script when available', async () => {
    const exec = vi.fn(async (_command: string, _args: string[]) => ({
      stdout: '',
      stderr: '',
      exitCode: 0,
    }));

    const deps = createDeps({
      async readJsonFile() {
        return { scripts: { 'db:seed': 'tsx scripts/seed.ts' } };
      },
      async executeCommand(command, args) {
        return exec(command, args);
      },
    });

    const service = createKitDbService(deps);
    await service.seed();

    expect(exec).toHaveBeenCalledWith('pnpm', [
      '--filter',
      'web',
      'run',
      'db:seed',
    ]);
  });
});
