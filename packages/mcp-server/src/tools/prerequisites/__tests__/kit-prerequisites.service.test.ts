import { describe, expect, it } from 'vitest';

import {
  type KitPrerequisitesDeps,
  createKitPrerequisitesService,
} from '../kit-prerequisites.service';

function createDeps(overrides: Partial<KitPrerequisitesDeps> = {}) {
  const base: KitPrerequisitesDeps = {
    async getVariantFamily() {
      return 'supabase';
    },
    async executeCommand(command: string, _args: string[]) {
      if (command === 'node')
        return { stdout: 'v22.5.0\n', stderr: '', exitCode: 0 };
      if (command === 'pnpm')
        return { stdout: '10.19.0\n', stderr: '', exitCode: 0 };
      if (command === 'git')
        return { stdout: 'git version 2.44.0\n', stderr: '', exitCode: 0 };
      if (command === 'docker')
        return {
          stdout: 'Docker version 26.1.0, build abc\n',
          stderr: '',
          exitCode: 0,
        };
      if (command === 'supabase')
        return { stdout: '2.75.5\n', stderr: '', exitCode: 0 };
      if (command === 'stripe') throw new Error('not installed');

      throw new Error(`unexpected command: ${command}`);
    },
  };

  return {
    ...base,
    ...overrides,
  };
}

describe('KitPrerequisitesService', () => {
  it('returns pass/warn statuses in a healthy supabase setup', async () => {
    const service = createKitPrerequisitesService(createDeps());
    const result = await service.check({});

    expect(result.ready_to_develop).toBe(true);
    expect(result.overall).toBe('warn');

    const node = result.prerequisites.find((item) => item.id === 'node');
    const supabase = result.prerequisites.find(
      (item) => item.id === 'supabase',
    );
    const stripe = result.prerequisites.find((item) => item.id === 'stripe');

    expect(node?.status).toBe('pass');
    expect(supabase?.status).toBe('pass');
    expect(stripe?.status).toBe('warn');
  });

  it('fails when required supabase cli is missing for supabase family', async () => {
    const service = createKitPrerequisitesService(
      createDeps({
        async executeCommand(command: string, args: string[]) {
          if (command === 'supabase') {
            throw new Error('missing');
          }

          return createDeps().executeCommand(command, args);
        },
      }),
    );

    const result = await service.check({});
    const supabase = result.prerequisites.find(
      (item) => item.id === 'supabase',
    );

    expect(supabase?.required).toBe(true);
    expect(supabase?.status).toBe('fail');
    expect(result.overall).toBe('fail');
    expect(result.ready_to_develop).toBe(false);
  });

  it('treats supabase cli as optional for orm family', async () => {
    const service = createKitPrerequisitesService(
      createDeps({
        async getVariantFamily() {
          return 'orm';
        },
        async executeCommand(command: string, args: string[]) {
          if (command === 'supabase') {
            throw new Error('missing');
          }

          return createDeps().executeCommand(command, args);
        },
      }),
    );

    const result = await service.check({});
    const supabase = result.prerequisites.find(
      (item) => item.id === 'supabase',
    );

    expect(supabase?.required).toBe(false);
    expect(supabase?.status).toBe('warn');
    expect(result.overall).toBe('warn');
    expect(result.ready_to_develop).toBe(true);
  });
});
