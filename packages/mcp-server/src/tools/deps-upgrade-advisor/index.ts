import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  type DepsUpgradeAdvisorDeps,
  createDepsUpgradeAdvisorService,
} from './deps-upgrade-advisor.service';
import {
  DepsUpgradeAdvisorInputSchema,
  DepsUpgradeAdvisorOutputSchema,
} from './schema';

const execFileAsync = promisify(execFile);

export function registerDepsUpgradeAdvisorTool(server: McpServer) {
  return registerDepsUpgradeAdvisorToolWithDeps(
    server,
    createDepsUpgradeAdvisorDeps(),
  );
}

export function registerDepsUpgradeAdvisorToolWithDeps(
  server: McpServer,
  deps: DepsUpgradeAdvisorDeps,
) {
  const service = createDepsUpgradeAdvisorService(deps);

  return server.registerTool(
    'deps_upgrade_advisor',
    {
      description:
        'Analyze outdated dependencies and return risk-bucketed upgrade recommendations',
      inputSchema: DepsUpgradeAdvisorInputSchema,
      outputSchema: DepsUpgradeAdvisorOutputSchema,
    },
    async (input) => {
      try {
        const parsed = DepsUpgradeAdvisorInputSchema.parse(input);
        const result = await service.advise(parsed);

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
              text: `deps_upgrade_advisor failed: ${toErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}

function createDepsUpgradeAdvisorDeps(): DepsUpgradeAdvisorDeps {
  const rootPath = process.cwd();

  return {
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
    nowIso() {
      return new Date().toISOString();
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
  createDepsUpgradeAdvisorService,
  type DepsUpgradeAdvisorDeps,
} from './deps-upgrade-advisor.service';
export type { DepsUpgradeAdvisorOutput } from './schema';
