import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  type RunChecksDeps,
  createRunChecksService,
} from './run-checks.service';
import { RunChecksInputSchema, RunChecksOutputSchema } from './schema';

const execFileAsync = promisify(execFile);

export function registerRunChecksTool(server: McpServer) {
  const service = createRunChecksService(createRunChecksDeps());

  return server.registerTool(
    'run_checks',
    {
      description:
        'Run code quality checks (typecheck, lint, format, and optional tests) with structured output',
      inputSchema: RunChecksInputSchema,
      outputSchema: RunChecksOutputSchema,
    },
    async (input) => {
      try {
        const parsed = RunChecksInputSchema.parse(input);
        const result = await service.run(parsed);

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
              text: `run_checks failed: ${toErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}

export function createRunChecksDeps(rootPath = process.cwd()): RunChecksDeps {
  return {
    rootPath,
    async readRootPackageJson() {
      const path = join(rootPath, 'package.json');
      const content = await readFile(path, 'utf8');
      return JSON.parse(content) as { scripts?: Record<string, string> };
    },
    async executeCommand(command, args) {
      try {
        const result = await execFileAsync(command, args, {
          cwd: rootPath,
          maxBuffer: 1024 * 1024 * 10,
        });

        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: 0,
        };
      } catch (error) {
        if (isExecError(error)) {
          return {
            stdout: error.stdout ?? '',
            stderr: error.stderr ?? '',
            exitCode: error.code,
          };
        }

        throw error;
      }
    },
    now() {
      return Date.now();
    },
  };
}

interface ExecError extends Error {
  code: number;
  stdout?: string;
  stderr?: string;
}

function isExecError(error: unknown): error is ExecError {
  return error instanceof Error && 'code' in error;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

export {
  createRunChecksService,
  type RunChecksDeps,
} from './run-checks.service';
export type { RunChecksOutput } from './schema';
