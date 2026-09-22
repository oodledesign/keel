import { describe, expect, it } from 'vitest';

import {
  cleanDictationTranscript,
  cleanStoredSpeakerSegments,
} from './dictation-transcript-cleanup';

const FAQ_SENTENCE =
  'The button that just has button text written on the FAQs page, can that have an anchor link down to the first section of FAQs and say something like "read FAQs now" or "explore FAQs now';

describe('cleanDictationTranscript', () => {
  it('collapses Dan’s repeated dictation and drops the cut-off restart', () => {
    const raw =
      `${FAQ_SENTENCE}The button that just has button text written on the FAQs page, can that have an anchor link down to the first section of FAQs and say something like "read FAQs now" or "explore FAQs now` +
      'the button tha';

    expect(cleanDictationTranscript(raw)).toBe(FAQ_SENTENCE);
    expect(cleanDictationTranscript(raw)).toContain('button text');
    expect(
      cleanDictationTranscript(FAQ_SENTENCE + FAQ_SENTENCE + FAQ_SENTENCE),
    ).toBe(FAQ_SENTENCE);
    expect(cleanDictationTranscript(cleanDictationTranscript(raw))).toBe(
      FAQ_SENTENCE,
    );
  });

  it('collapses a spaced second copy and a spaced incomplete restart', () => {
    const raw = `${FAQ_SENTENCE} ${FAQ_SENTENCE} the button tha`;
    expect(cleanDictationTranscript(raw)).toBe(FAQ_SENTENCE);
  });

  it('keeps the longer hypothesis when a short prefix is glued to the full sentence', () => {
    const full =
      'Please send the final logo files to the client before Friday so they can review the homepage.';
    const partial = full.slice(0, 58);
    expect(cleanDictationTranscript(partial + full)).toBe(full);
  });

  it('soft-joins a missing space after the removed copy when the tail is new', () => {
    const sentence =
      'Please send the final logo files to the client before Friday so they can review.';
    const raw = `${sentence}${sentence}Budget is approved for the design work.`;
    expect(cleanDictationTranscript(raw)).toBe(
      `${sentence} Budget is approved for the design work.`,
    );
  });

  it('leaves ordinary notes, short repeats, and product names alone', () => {
    const samples = [
      'Call Dan',
      'yes yes yes',
      'The button says iPhone and macOS in the FAQs.',
      'Buy milk tomorrow and pick up the boards.',
    ];

    for (const sample of samples) {
      expect(cleanDictationTranscript(sample)).toBe(sample);
    }
  });

  it('does not collapse a meeting just because two speakers talk', () => {
    const meeting = [
      'Me: The homepage hero should mention the spring campaign and the new case study.',
      '',
      'Alex: I can send the logo files on Thursday once the client signs off.',
    ].join('\n');

    expect(cleanDictationTranscript(meeting)).toBe(meeting);
  });

  it('drops a glued incomplete restart after a speaker label', () => {
    const line = `Me: ${FAQ_SENTENCE}`;
    const raw = `${line}the button tha`;
    expect(cleanDictationTranscript(raw)).toBe(line);
  });

  it('keeps a short follow-up that is not a truncated restart', () => {
    const raw = `${FAQ_SENTENCE} Thanks.`;
    expect(cleanDictationTranscript(raw)).toBe(raw);
  });
});

describe('cleanStoredSpeakerSegments', () => {
  it('cleans only the segment that repeats and keeps timestamps', () => {
    const cleaned = cleanStoredSpeakerSegments([
      {
        speaker: 'Me',
        text: `${FAQ_SENTENCE}${FAQ_SENTENCE}the button tha`,
        startMs: 1200,
      },
      {
        speaker: 'Alex',
        text: 'I will send the assets on Thursday.',
        startMs: 8400,
      },
    ]);

    expect(cleaned?.changed).toBe(true);
    expect(cleaned?.segments).toEqual([
      {
        speaker: 'Me',
        text: FAQ_SENTENCE,
        startMs: 1200,
      },
      {
        speaker: 'Alex',
        text: 'I will send the assets on Thursday.',
        startMs: 8400,
      },
    ]);
  });

  it('reports no change for a normal meeting', () => {
    const segments = [
      { speaker: 'Me', text: 'Let us review the homepage.' },
      { speaker: 'Alex', text: 'I will send the files.' },
    ];
    expect(cleanStoredSpeakerSegments(segments)).toEqual({
      segments,
      changed: false,
    });
  });
});
