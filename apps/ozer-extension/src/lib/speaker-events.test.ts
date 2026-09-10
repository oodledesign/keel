import { describe, expect, it } from 'vitest';

import { SpeakerTurnTracker } from './speaker-events';

describe('SpeakerTurnTracker', () => {
  it('emits a closed turn when the speaker changes', () => {
    const tracker = new SpeakerTurnTracker();
    expect(
      tracker.observe(
        { name: 'Ada', source: 'active_speaker', confidence: 'high' },
        '2026-09-10T10:00:00.000Z',
      ),
    ).toBeNull();

    const closed = tracker.observe(
      { name: 'Sam', source: 'caption', confidence: 'medium' },
      '2026-09-10T10:00:08.000Z',
    );

    expect(closed).toEqual({
      name: 'Ada',
      startedAt: '2026-09-10T10:00:00.000Z',
      endedAt: '2026-09-10T10:00:08.000Z',
      source: 'active_speaker',
      confidence: 'high',
    });
  });

  it('keeps unknown speakers as null instead of Them', () => {
    const tracker = new SpeakerTurnTracker();
    tracker.observe(
      { name: null, source: 'unknown', confidence: 'low' },
      '2026-09-10T10:00:00.000Z',
    );
    const closed = tracker.flush('2026-09-10T10:00:05.000Z');
    expect(closed?.name).toBeNull();
  });
});
