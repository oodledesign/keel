import { describe, expect, it } from 'vitest';

import { replaceTranscriptWords } from './transcript-edit';

const words = [
  { text: 'Hi', startMs: 0, endMs: 200 },
  { text: 'Brain,', startMs: 250, endMs: 600 },
  { text: 'thanks', startMs: 700, endMs: 1000 },
  { text: 'Brain', startMs: 1100, endMs: 1400 },
  { text: 'again.', startMs: 1450, endMs: 1800 },
];
const plainText = 'Hi Brain, thanks Brain again.';

describe('replaceTranscriptWords', () => {
  it('fixes one word, keeping timing and surrounding punctuation', () => {
    const result = replaceTranscriptWords({
      words,
      plainText,
      fromIndex: 1,
      toIndex: 1,
      text: 'Brian,',
    });
    expect(result.words[1]).toEqual({
      text: 'Brian,',
      startMs: 250,
      endMs: 600,
    });
    expect(result.plainText).toBe('Hi Brian, thanks Brain again.');
  });

  it('patches the matching occurrence in the plain text', () => {
    const result = replaceTranscriptWords({
      words,
      plainText,
      fromIndex: 3,
      toIndex: 3,
      text: 'Brian',
    });
    expect(result.plainText).toBe('Hi Brain, thanks Brian again.');
  });

  it('keeps separators between words when the word count matches', () => {
    const result = replaceTranscriptWords({
      words,
      plainText,
      fromIndex: 1,
      toIndex: 2,
      text: 'Brian thanks',
    });
    expect(result.plainText).toBe('Hi Brian, thanks Brain again.');
  });

  it('spreads a different number of words across the selection span', () => {
    const result = replaceTranscriptWords({
      words,
      plainText,
      fromIndex: 1,
      toIndex: 1,
      text: 'Bri an',
    });
    expect(result.words).toHaveLength(6);
    expect(result.words[1]).toMatchObject({
      text: 'Bri',
      startMs: 250,
      endMs: 425,
    });
    expect(result.words[2]).toMatchObject({
      text: 'an',
      startMs: 425,
      endMs: 600,
    });
    expect(result.plainText).toBe('Hi Bri an, thanks Brain again.');
  });

  it('keeps Whisper-style leading spaces on word text', () => {
    const result = replaceTranscriptWords({
      words: [
        { text: ' hello', startMs: 0, endMs: 200 },
        { text: ' wrld', startMs: 200, endMs: 400 },
      ],
      plainText: 'Hello, wrld!',
      fromIndex: 1,
      toIndex: 1,
      text: 'world',
    });
    expect(result.words[1]!.text).toBe(' world');
    expect(result.plainText).toBe('Hello, world!');
  });

  it('rebuilds the plain text when the phrase cannot be found', () => {
    const result = replaceTranscriptWords({
      words,
      plainText: 'Completely different text',
      fromIndex: 1,
      toIndex: 1,
      text: 'Brian,',
    });
    expect(result.plainText).toBe('Hi Brian, thanks Brain again.');
  });
});
