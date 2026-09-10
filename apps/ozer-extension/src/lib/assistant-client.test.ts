import { describe, expect, it, vi } from 'vitest';

import {
  checkAssistantHealth,
  postAssistantSpeakerEvents,
  toAssistantSpeakerStamps,
} from './assistant-client';
import type { ExtensionSpeakerEvent } from './protocol';

const event: ExtensionSpeakerEvent = {
  name: 'Ada',
  startedAt: '2026-09-10T10:00:00.000Z',
  endedAt: '2026-09-10T10:00:03.000Z',
  source: 'active_speaker',
  confidence: 'high',
};

describe('toAssistantSpeakerStamps', () => {
  it('sends a single stamp as { name, startedAt, endedAt }', () => {
    expect(toAssistantSpeakerStamps([event])).toEqual({
      name: 'Ada',
      startedAt: '2026-09-10T10:00:00.000Z',
      endedAt: '2026-09-10T10:00:03.000Z',
    });
  });

  it('wraps multiple stamps in { events }', () => {
    expect(
      toAssistantSpeakerStamps([event, { ...event, name: 'Sam' }]),
    ).toEqual({
      events: [
        {
          name: 'Ada',
          startedAt: '2026-09-10T10:00:00.000Z',
          endedAt: '2026-09-10T10:00:03.000Z',
        },
        {
          name: 'Sam',
          startedAt: '2026-09-10T10:00:00.000Z',
          endedAt: '2026-09-10T10:00:03.000Z',
        },
      ],
    });
  });
});

describe('postAssistantSpeakerEvents', () => {
  it('posts the live contract to 18791 /v1/meet/speaker-stamps', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const ok = await postAssistantSpeakerEvents(
      {
        sessionId: 'abc-defg-hij',
        events: [event],
      },
      'http://127.0.0.1:18791',
      fetchImpl as unknown as typeof fetch,
    );

    expect(ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'http://127.0.0.1:18791/v1/meet/speaker-stamps',
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      name: 'Ada',
      startedAt: '2026-09-10T10:00:00.000Z',
      endedAt: '2026-09-10T10:00:03.000Z',
    });
  });

  it('falls back to the 17834 /v1/speaker-events alias when the live path is down', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('stamps down'))
      .mockRejectedValueOnce(new Error('legacy stamps down'))
      .mockResolvedValueOnce({ ok: true });

    const ok = await postAssistantSpeakerEvents(
      {
        sessionId: 'abc-defg-hij',
        events: [event],
      },
      'http://127.0.0.1:18791',
      fetchImpl as unknown as typeof fetch,
    );

    expect(ok).toBe(true);
    expect(fetchImpl.mock.calls.map((call) => String(call[0]))).toEqual([
      'http://127.0.0.1:18791/v1/meet/speaker-stamps',
      'http://127.0.0.1:17834/v1/meet/speaker-stamps',
      'http://127.0.0.1:17834/v1/speaker-events',
    ]);
    expect(
      JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body)),
    ).toMatchObject({
      sessionId: 'abc-defg-hij',
      events: [event],
    });
  });

  it('returns false when Assistant aliases are all down', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(
      postAssistantSpeakerEvents(
        { sessionId: 'abc-defg-hij', events: [event] },
        undefined,
        fetchImpl as unknown as typeof fetch,
      ),
    ).resolves.toBe(false);
  });
});

describe('checkAssistantHealth', () => {
  it('returns null when Assistant is not running', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(
      checkAssistantHealth(undefined, fetchImpl),
    ).resolves.toBeNull();
  });

  it('probes 18791 first, then the 17834 alias', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, recording: true }),
      });

    await expect(
      checkAssistantHealth(
        'http://127.0.0.1:18791',
        fetchImpl as unknown as typeof fetch,
      ),
    ).resolves.toEqual({ ok: true, recording: true });

    expect(fetchImpl.mock.calls.map((call) => String(call[0]))).toEqual([
      'http://127.0.0.1:18791/v1/health',
      'http://127.0.0.1:17834/v1/health',
    ]);
  });
});
