import { describe, expect, it } from 'vitest';

import {
  activeSegmentIndex,
  buildTranscriptSegments,
} from './transcript-segments';

function word(text: string, startMs: number, endMs = startMs + 400) {
  return { text, startMs, endMs };
}

describe('buildTranscriptSegments', () => {
  it('keeps short sentences together and breaks after ~8s on a sentence end', () => {
    const segments = buildTranscriptSegments(
      [
        word('Hi.', 0),
        word('Short', 1500),
        word('one.', 3000),
        word('Still', 4500),
        word('rambling', 6000),
        word('going.', 7500),
        word('Next', 9000),
      ],
      null,
    );
    expect(segments.map((s) => s.text)).toEqual([
      'Hi. Short one. Still rambling going.',
      'Next',
    ]);
    expect(segments[1]!.startMs).toBe(9000);
  });

  it('breaks on long pauses', () => {
    const segments = buildTranscriptSegments(
      [word('Before', 0), word('after', 3000)],
      null,
    );
    expect(segments.map((s) => s.text)).toEqual(['Before', 'after']);
  });

  it('drops deleted words and maps times onto the edited timeline', () => {
    const segments = buildTranscriptSegments(
      [word('Keep', 0), word('cut', 2000), word('also', 4000)],
      [
        { startMs: 0, endMs: 1000 },
        { startMs: 4000, endMs: 5000 },
      ],
    );
    expect(segments.map((s) => s.text)).toEqual(['Keep also']);
    expect(segments[0]!.endMs).toBe(1400);
  });
});

describe('activeSegmentIndex', () => {
  const segments = [
    { startMs: 0, endMs: 1000, text: 'a' },
    { startMs: 5000, endMs: 6000, text: 'b' },
  ];

  it('holds the previous segment through gaps', () => {
    expect(activeSegmentIndex(segments, 3000)).toBe(0);
    expect(activeSegmentIndex(segments, 5000)).toBe(1);
  });

  it('returns -1 before the first segment', () => {
    expect(activeSegmentIndex([{ ...segments[1]! }], 100)).toBe(-1);
  });
});
