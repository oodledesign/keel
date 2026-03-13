import type {
  RunChecksInput,
  RunChecksOutput,
  RunChecksResult,
} from './schema';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunChecksDeps {
  rootPath: string;
  readRootPackageJson(): Promise<{ scripts?: Record<string, string> }>;
  executeCommand(command: string, args: string[]): Promise<CommandResult>;
  now(): number;
}

const DEFAULT_SCRIPTS = ['typecheck', 'lint:fix', 'format:fix'] as const;

export function createRunChecksService(deps: RunChecksDeps) {
  return new RunChecksService(deps);
}

export class RunChecksService {
  constructor(private readonly deps: RunChecksDeps) {}

  async run(input: RunChecksInput): Promise<RunChecksOutput> {
    const options = input.state ?? {};
    const includeTests = options.includeTests ?? false;
    const failFast = options.failFast ?? false;
    const maxOutputChars = options.maxOutputChars ?? 4000;

    const scriptsRequested = this.resolveScripts(options.scripts, includeTests);
    const checks: RunChecksResult[] = [];

    const packageJson = await this.deps.readRootPackageJson();
    const availableScripts = new Set(Object.keys(packageJson.scripts ?? {}));

    let stopRunning = false;

    for (const script of scriptsRequested) {
      if (stopRunning) {
        checks.push({
          script,
          command: `pnpm run ${script}`,
          status: 'skipped',
          exit_code: null,
          duration_ms: 0,
          stdout: '',
          stderr: '',
          message:
            'Skipped because failFast is enabled and a previous check failed.',
        });
        continue;
      }

      if (!availableScripts.has(script)) {
        checks.push({
          script,
          command: `pnpm run ${script}`,
          status: 'missing',
          exit_code: null,
          duration_ms: 0,
          stdout: '',
          stderr: '',
          message: `Script "${script}" was not found in root package.json.`,
        });

        if (failFast) {
          stopRunning = true;
        }

        continue;
      }

      const startedAt = this.deps.now();
      const result = await this.deps.executeCommand('pnpm', ['run', script]);
      const duration = Math.max(0, this.deps.now() - startedAt);
      const status = result.exitCode === 0 ? 'pass' : 'fail';

      checks.push({
        script,
        command: `pnpm run ${script}`,
        status,
        exit_code: result.exitCode,
        duration_ms: duration,
        stdout: truncateOutput(result.stdout, maxOutputChars),
        stderr: truncateOutput(result.stderr, maxOutputChars),
      });

      if (status === 'fail' && failFast) {
        stopRunning = true;
      }
    }

    const summary = {
      total: checks.length,
      passed: checks.filter((check) => check.status === 'pass').length,
      failed: checks.filter((check) => check.status === 'fail').length,
      missing: checks.filter((check) => check.status === 'missing').length,
      skipped: checks.filter((check) => check.status === 'skipped').length,
    };

    return {
      overall: summary.failed > 0 || summary.missing > 0 ? 'fail' : 'pass',
      scripts_requested: scriptsRequested,
      checks,
      summary,
    };
  }

  private resolveScripts(scripts: string[] | undefined, includeTests: boolean) {
    const list = scripts && scripts.length > 0 ? scripts : [...DEFAULT_SCRIPTS];

    if (includeTests) {
      list.push('test');
    }

    return dedupe(list);
  }
}

function dedupe(list: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of list) {
    if (seen.has(item)) {
      continue;
    }

    seen.add(item);
    output.push(item);
  }

  return output;
}

function truncateOutput(value: string, maxOutputChars: number) {
  if (value.length <= maxOutputChars) {
    return value;
  }

  return `${value.slice(0, maxOutputChars)}\n...[truncated ${value.length - maxOutputChars} chars]`;
}
