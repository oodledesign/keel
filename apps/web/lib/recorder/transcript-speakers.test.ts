import { describe, expect, it } from 'vitest';

import {
  distinctTranscriptSpeakers,
  normalizeSpeakerMappings,
  parseTranscriptContent,
  renameSpeakersInSegments,
  resolveSpeakerLabel,
  resolveTranscriptSegments,
  serializeResolvedTranscriptSegments,
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

describe('speaker mappings', () => {
  const clients = [{ id: 'c1', name: 'Acme Corp' }];
  const contacts = [{ id: 'p1', name: 'Jane Doe' }];

  it('normalizes valid bindings and ignores invalid entries', () => {
    expect(
      normalizeSpeakerMappings({
        'Speaker 1': { type: 'custom', name: ' Alex ' },
        'Speaker 2': { type: 'client', clientId: 'c1' },
        'Speaker 3': { type: 'contact', contactId: 'p1' },
        'Speaker 4': { type: 'custom', name: '   ' },
        bad: null,
      }),
    ).toEqual({
      'Speaker 1': { type: 'custom', name: 'Alex' },
      'Speaker 2': { type: 'client', clientId: 'c1' },
      'Speaker 3': { type: 'contact', contactId: 'p1' },
    });
  });

  it('resolves labels from clients, contacts, and custom names', () => {
    const mappings = {
      'Speaker 1': { type: 'client' as const, clientId: 'c1' },
      'Speaker 2': { type: 'contact' as const, contactId: 'p1' },
      'Speaker 3': { type: 'custom' as const, name: 'Guest' },
    };

    expect(resolveSpeakerLabel('Speaker 1', mappings, clients, contacts)).toBe(
      'Acme Corp',
    );
    expect(resolveSpeakerLabel('Speaker 2', mappings, clients, contacts)).toBe(
      'Jane Doe',
    );
    expect(resolveSpeakerLabel('Speaker 3', mappings, clients, contacts)).toBe(
      'Guest',
    );
    expect(resolveSpeakerLabel('Speaker 4', mappings, clients, contacts)).toBe(
      'Speaker 4',
    );
  });

  it('serializes segments with resolved speaker names', () => {
    const segments = [
      { speaker: 'Speaker 1', text: 'Hello' },
      { speaker: 'Speaker 2', text: 'Hi there' },
    ];
    const mappings = {
      'Speaker 1': { type: 'client' as const, clientId: 'c1' },
      'Speaker 2': { type: 'custom' as const, name: 'Bob' },
    };

    expect(
      serializeResolvedTranscriptSegments(segments, mappings, clients, contacts),
    ).toBe('Acme Corp: Hello\n\nBob: Hi there');
  });
});
