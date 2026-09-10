import { describe, expect, it } from 'vitest';

import { ExtensionCaptureSchema } from './capture-schema';

describe('ExtensionCaptureSchema', () => {
  it('accepts a task from selected text', () => {
    const parsed = ExtensionCaptureSchema.parse({
      kind: 'task',
      title: 'Follow up with Ada',
      body: 'Send the deck',
      url: 'https://example.com/page',
    });
    expect(parsed.kind).toBe('task');
  });

  it('rejects a contact stub without a name', () => {
    const parsed = ExtensionCaptureSchema.safeParse({
      kind: 'contact',
      body: 'Someone from Meet',
    });
    expect(parsed.success).toBe(false);
  });
});
