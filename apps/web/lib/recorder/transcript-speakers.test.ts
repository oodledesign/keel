import { describe, expect, it } from 'vitest';

import {
  distinctTranscriptSpeakers,
  parseTranscriptContent,
  renameSpeakersInSegments,
  resolveTranscriptSegments,
  serializeTranscriptSegments,
} from './transcript-speakers';

describe('parseTranscriptContent', () => {
  it('parses newline-separated speaker lines', () => {
    const { segments, hasSpeakerLabels } = parseTranscriptContent(
      'Speaker 1: Hello everyone\nSpeaker 2: Thanks for joining',
    );

    expect(hasSpeakerLabels).toBe(true);
    expect(segments).toEqual([
      { speaker: 'Speaker 1', text: 'Hello everyone' },
      { speaker: 'Speaker 2', text: 'Thanks for joining' },
    ]);
  });

  it('parses blank-line-separated blocks', () => {
    const { segments } = parseTranscriptContent(
      'Sarah Chen: We should ship Friday.\n\nSpeaker 2: Sounds good.',
    );

    expect(segments).toEqual([
      { speaker: 'Sarah Chen', text: 'We should ship Friday.' },
      { speaker: 'Speaker 2', text: 'Sounds good.' },
    ]);
  });

  it('appends continuation lines to the current speaker', () => {
    const { segments } = parseTranscriptContent(
      'Speaker 1: Line one\nand line two\nSpeaker 2: Next',
    );

    expect(segments[0]?.text).toBe('Line one\nand line two');
  });

  it('reports no labels for plain prose', () => {
    const { segments, hasSpeakerLabels } = parseTranscriptContent(
      'This meeting had no speaker prefixes.',
    );

    expect(hasSpeakerLabels).toBe(false);
    expect(segments).toEqual([
      { speaker: 'Unknown', text: 'This meeting had no speaker prefixes.' },
    ]);
  });
});

describe('serializeTranscriptSegments', () => {
  it('round-trips speaker-labelled content', () => {
    const content =
      'Speaker 1: Hello everyone\n\nSpeaker 2: Thanks for joining';
    const { segments } = parseTranscriptContent(content);
    expect(serializeTranscriptSegments(segments)).toBe(content);
  });
});

describe('renameSpeakersInSegments', () => {
  it('renames every matching speaker label', () => {
    const segments = [
      { speaker: 'Speaker 2', text: 'Hello' },
      { speaker: 'Speaker 1', text: 'Hi' },
      { speaker: 'Speaker 2', text: 'Again' },
    ];

    const renamed = renameSpeakersInSegments(segments, {
      'Speaker 2': 'Sarah Chen',
    });

    expect(distinctTranscriptSpeakers(renamed)).toEqual(['Sarah Chen', 'Speaker 1']);
    expect(serializeTranscriptSegments(renamed)).toBe(
      'Sarah Chen: Hello\n\nSpeaker 1: Hi\n\nSarah Chen: Again',
    );
  });
});

describe('resolveTranscriptSegments', () => {
  it('prefers stored segments over parsed content', () => {
    const segments = resolveTranscriptSegments({
      content: 'Speaker 1: Old',
      speakerSegments: [{ speaker: 'Sarah Chen', text: 'Stored line' }],
    });

    expect(segments).toEqual([{ speaker: 'Sarah Chen', text: 'Stored line' }]);
  });
});
