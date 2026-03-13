import { describe, expect, it } from 'vitest';

import { registerKitPrerequisitesTool } from '../index';
import { KitPrerequisitesOutputSchema } from '../schema';

interface RegisteredTool {
  name: string;
  handler: (input: unknown) => Promise<Record<string, unknown>>;
}

describe('registerKitPrerequisitesTool', () => {
  it('registers kit_prerequisites and returns typed structured output', async () => {
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

    registerKitPrerequisitesTool(server as never);

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe('kit_prerequisites');

    const result = await tools[0]!.handler({});
    const parsed = KitPrerequisitesOutputSchema.parse(result.structuredContent);

    expect(parsed.prerequisites.length).toBeGreaterThan(0);
    expect(typeof parsed.ready_to_develop).toBe('boolean');
  });
});
