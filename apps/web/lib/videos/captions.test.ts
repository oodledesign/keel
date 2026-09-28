import { describe, expect, it } from 'vitest';

import {
  buildCaptionCues,
  captionCueAt,
  cuesToEditedTime,
  cuesToSrt,
  transcriptHasRealTimings,
} from './captions';

const words = [
  { text: 'Hello', startMs: 0, endMs: 400 },
  { text: 'there.', startMs: 450, endMs: 900 },
  { text: 'This', startMs: 1000, endMs: 1200 },
  { text: 'part', startMs: 1250, endMs: 1500 },
  { text: 'is', startMs: 2300, endMs: 2400 },
  { text: 'cut', startMs: 2450, endMs: 2700 },
  { text: 'Back', startMs: 3500, endMs: 3800 },
  { text: 'again', startMs: 3850, endMs: 4200 },
];

describe('buildCaptionCues', () => {
  it('breaks on sentence ends and pauses', () => {
    const cues = buildCaptionCues(words, null);
    expect(cues.map((c) => c.text)).toEqual([
      'Hello there.',
      'This part',
      'is cut',
      'Back again',
    ]);
  });

  it('drops words in deleted ranges and never spans a cut', () => {
    const keep = [
      { startMs: 0, endMs: 1600 },
      { startMs: 3400, endMs: 4500 },
    ];
    const cues = buildCaptionCues(words, keep);
    expect(cues.map((c) => c.text)).toEqual([
      'Hello there.',
      'This part',
      'Back again',
    ]);
    expect(cues[1]!.endMs).toBeLessThanOrEqual(1600);
  });

  it('re-times cues onto the edited timeline', () => {
    const keep = [
      { startMs: 500, endMs: 1600 },
      { startMs: 3400, endMs: 4500 },
    ];
    const edited = cuesToEditedTime(buildCaptionCues(words, keep), keep);
    expect(edited[0]).toMatchObject({ text: 'there.', startMs: 0 });
    const back = edited.find((c) => c.text === 'Back again')!;
    expect(back.startMs).toBe(1100 + 100);
  });
});

describe('captions helpers', () => {
  it('finds the active cue', () => {
    const cues = buildCaptionCues(words, null);
    expect(captionCueAt(cues, 1300)?.text).toBe('This part');
    expect(captionCueAt(cues, 3300)).toBeNull();
  });

  it('formats SRT timestamps', () => {
    const srt = cuesToSrt([
      { startMs: 3_723_045, endMs: 3_724_000, text: 'Hi' },
    ]);
    expect(srt).toBe('1\n01:02:03,045 --> 01:02:04,000\nHi\n');
  });

  it('rejects desktop estimated timings', () => {
    expect(transcriptHasRealTimings('desktop-speech', words)).toBe(false);
    expect(transcriptHasRealTimings('openai-whisper', words)).toBe(true);
    expect(transcriptHasRealTimings('openai-whisper', [])).toBe(false);
  });
});
