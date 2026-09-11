import { describe, expect, it } from 'vitest';

import {
  appendSpeakerTimeline,
  formatSpeakerTimeline,
} from './speaker-timeline';

describe('formatSpeakerTimeline', () => {
  it('renders timed Meet speaker stamps without collapsing unknowns to Them', () => {
    const text = formatSpeakerTimeline([
      {
        name: 'Ada Lovelace',
        startedAt: '2026-09-10T10:02:00.000Z',
        endedAt: '2026-09-10T10:04:00.000Z',
        source: 'active_speaker',
        confidence: 'high',
      },
      {
        name: null,
        startedAt: '2026-09-10T10:04:00.000Z',
        endedAt: null,
        source: 'unknown',
        confidence: 'low',
      },
    ]);

    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Unknown speaker');
    expect(text).not.toContain('Them');
  });

  it('appends a timeline after transcript text', () => {
    const combined = appendSpeakerTimeline('Ada: Hello', [
      {
        name: 'Ada',
        startedAt: '2026-09-10T10:02:00.000Z',
        endedAt: '2026-09-10T10:03:00.000Z',
        source: 'caption',
        confidence: 'medium',
      },
    ]);
    expect(combined.startsWith('Ada: Hello')).toBe(true);
    expect(combined).toContain('## Speakers (Google Meet)');
  });
});
