import { describe, expect, it } from 'vitest';

import {
  cleanedTextOrSource,
  parseSurveyTranscriptCleanup,
} from './survey-transcript-cleanup-parse';

describe('parseSurveyTranscriptCleanup', () => {
  it('reads cleanedText and ignores invented section fields', () => {
    const parsed = parseSurveyTranscriptCleanup(
      JSON.stringify({
        cleanedText: 'The stopcock under the sink is stiff.',
        sectionKey: 'windows',
        rics_code: 'D5',
      }),
    );

    expect(parsed).toEqual({
      cleanedText: 'The stopcock under the sink is stiff.',
    });
    expect(parsed).not.toHaveProperty('sectionKey');
    expect(parsed).not.toHaveProperty('rics_code');
  });

  it('accepts cleaned_text and fenced JSON', () => {
    const parsed = parseSurveyTranscriptCleanup(
      '```json\n{"cleaned_text":"Copper pipework to the rising main."}\n```',
    );
    expect(parsed?.cleanedText).toBe('Copper pipework to the rising main.');
  });

  it('returns null when the model omits usable text', () => {
    expect(parseSurveyTranscriptCleanup('{"sectionKey":"water"}')).toBeNull();
    expect(parseSurveyTranscriptCleanup('not json')).toBeNull();
    expect(parseSurveyTranscriptCleanup('')).toBeNull();
  });
});

describe('cleanedTextOrSource', () => {
  it('falls back to the raw dictation when cleanup is empty', () => {
    expect(
      cleanedTextOrSource({ cleanedText: '' }, '  Um, the sash is stiff.  '),
    ).toBe('Um, the sash is stiff.');
    expect(
      cleanedTextOrSource(
        { cleanedText: 'The sash is stiff.' },
        'Um the sash is stiff',
      ),
    ).toBe('The sash is stiff.');
  });
});
