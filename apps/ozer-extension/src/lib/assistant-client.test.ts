import { describe, expect, it, vi } from 'vitest';

import {
  checkAssistantHealth,
  postAssistantSpeakerEvents,
} from './assistant-client';

describe('assistant client', () => {
  it('returns null when Assistant is not running', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      checkAssistantHealth(undefined, fetchImpl),
    ).resolves.toBeNull();
  });

  it('posts speaker events to the local contract path', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const ok = await postAssistantSpeakerEvents(
      {
        sessionId: 'abc-defg-hij',
        events: [
          {
            name: 'Ada',
            startedAt: '2026-09-10T10:00:00.000Z',
            endedAt: '2026-09-10T10:00:03.000Z',
            source: 'active_speaker',
            confidence: 'high',
          },
        ],
      },
      'http://127.0.0.1:17834',
      fetchImpl as unknown as typeof fetch,
    );
    expect(ok).toBe(true);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'http://127.0.0.1:17834/v1/speaker-events',
    );
  });
});
