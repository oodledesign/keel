import { describe, expect, it } from 'vitest';

import {
  type RunChecksDeps,
  createRunChecksService,
} from '../run-checks.service';

function createDeps(
  overrides: Partial<RunChecksDeps> = {},
  scripts: Record<string, string> = {
    typecheck: 'tsc --noEmit',
    'lint:fix': 'eslint . --fix',
    'format:fix': 'prettier . --write',
    test: 'vitest run',
  },
): RunChecksDeps {
  let nowValue = 0;

  return {
    rootPath: '/repo',
    async readRootPackageJson() {
      return { scripts };
    },
    async executeCommand() {
      nowValue += 100;
      return {
        stdout: 'ok',
        stderr: '',
        exitCode: 0,
      };
    },
    now() {
      return nowValue;
    },
    ...overrides,
  };
}

describe('RunChecksService', () => {
  it('runs default scripts and reports pass', async () => {
    const service = createRunChecksService(createDeps());
    const result = await service.run({});

    expect(result.overall).toBe('pass');
    expect(result.scripts_requested).toEqual([
      'typecheck',
      'lint:fix',
      'format:fix',
    ]);
    expect(result.summary.passed).toBe(3);
  });

  it('includes tests when includeTests is true', async () => {
    const service = createRunChecksService(createDeps());
    const result = await service.run({ state: { includeTests: true } });

    expect(result.scripts_requested).toContain('test');
    expect(result.summary.total).toBe(4);
  });

  it('marks missing scripts as missing and fails overall', async () => {
    const service = createRunChecksService(
      createDeps(
        {},
        {
          typecheck: 'tsc --noEmit',
        },
      ),
    );
    const result = await service.run({
      state: { scripts: ['typecheck', 'lint:fix'] },
    });

    expect(result.overall).toBe('fail');
    expect(result.summary.missing).toBe(1);
    expect(
      result.checks.find((item) => item.script === 'lint:fix')?.status,
    ).toBe('missing');
  });

  it('stops subsequent checks when failFast is enabled', async () => {
    let calls = 0;
    const service = createRunChecksService(
      createDeps({
        async executeCommand(_command, args) {
          calls += 1;
          if (args[1] === 'typecheck') {
            return { stdout: '', stderr: 'boom', exitCode: 1 };
          }

          return { stdout: '', stderr: '', exitCode: 0 };
        },
      }),
    );

    const result = await service.run({
      state: {
        scripts: ['typecheck', 'lint:fix', 'format:fix'],
        failFast: true,
      },
    });

    expect(calls).toBe(1);
    expect(result.checks[0]?.status).toBe('fail');
    expect(result.checks[1]?.status).toBe('skipped');
    expect(result.checks[2]?.status).toBe('skipped');
  });
});
