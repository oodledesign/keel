import { describe, expect, it } from 'vitest';

import { registerDepsUpgradeAdvisorToolWithDeps } from '../index';
import { DepsUpgradeAdvisorOutputSchema } from '../schema';

interface RegisteredTool {
  name: string;
  handler: (input: unknown) => Promise<Record<string, unknown>>;
}

describe('registerDepsUpgradeAdvisorTool', () => {
  it('registers deps_upgrade_advisor and returns typed structured output', async () => {
    const tools: RegisteredTool[] = [];

    const server = {
      registerTool(
        name: string,
        _config: Record<string, unknown>,
        handler: (input: unknown) => Promise<Record<string, unknown>>,
      ) {
        tools.push({ name, handler });
        return {};
      },
    };

    registerDepsUpgradeAdvisorToolWithDeps(server as never, {
      async executeCommand() {
        return {
          stdout: '[]',
          stderr: '',
          exitCode: 0,
        };
      },
      nowIso() {
        return '2026-02-09T00:00:00.000Z';
      },
    });

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('deps_upgrade_advisor');

    const result = await tools[0]!.handler({});
    const parsed = DepsUpgradeAdvisorOutputSchema.parse(
      result.structuredContent,
    );

    expect(parsed.generated_at).toBeTruthy();
    expect(Array.isArray(parsed.recommendations)).toBe(true);
  });
});
