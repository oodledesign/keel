import { describe, expect, it, vi } from 'vitest';

import { absoluteOzerPath, captureToOzer } from './ozer-api';

describe('ozer api helpers', () => {
  it('builds an absolute workspace URL', () => {
    expect(absoluteOzerPath('https://app.ozer.so', '/app/notes/1')).toBe(
      'https://app.ozer.so/app/notes/1',
    );
  });

  it('posts capture payloads with the keel bearer token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 't1',
        kind: 'task',
        detail_path: '/app/tasks',
        title: 'Call Dan',
      }),
    });

    const result = await captureToOzer(
      'keel_token',
      { kind: 'task', title: 'Call Dan' },
      'https://app.ozer.so',
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.id).toBe('t1');
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer keel_token',
      },
    });
  });
});
