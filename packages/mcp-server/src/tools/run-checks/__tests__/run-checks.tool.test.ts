import { describe, expect, it } from 'vitest';

import { registerRunChecksTool } from '../index';
import { RunChecksOutputSchema } from '../schema';

interface RegisteredTool {
  name: string;
  handler: (input: unknown) => Promise<Record<string, unknown>>;
}

describe('registerRunChecksTool', () => {
  it('registers run_checks and returns typed structured output', async () => {
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

    registerRunChecksTool(server as never);

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('run_checks');

    const result = await tools[0]!.handler({});
    const parsed = RunChecksOutputSchema.parse(result.structuredContent);

    expect(parsed.summary.total).toBeGreaterThan(0);
  });
});
