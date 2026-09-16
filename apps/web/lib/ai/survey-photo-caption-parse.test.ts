import { describe, expect, it } from 'vitest';

import {
  applyCaptionsIfEmpty,
  parseSurveyPhotoCaptions,
} from './survey-photo-caption-parse';

describe('parseSurveyPhotoCaptions', () => {
  it('reads caption drafts from fenced JSON', () => {
    const drafts = parseSurveyPhotoCaptions(
      '```json\n{"captions":[{"docId":"11111111-1111-4111-8111-111111111111","caption":"Stiff sash."}]}\n```',
    );
    expect(drafts).toEqual([
      {
        docId: '11111111-1111-4111-8111-111111111111',
        caption: 'Stiff sash.',
      },
    ]);
  });

  it('drops empty or invalid rows', () => {
    expect(
      parseSurveyPhotoCaptions(
        JSON.stringify({
          captions: [
            { docId: 'a', caption: '' },
            { docId: '', caption: 'Hello' },
            { caption: 'Missing id' },
          ],
        }),
      ),
    ).toEqual([]);
  });
});

describe('applyCaptionsIfEmpty', () => {
  const photos = [
    { id: 'p1', caption: 'Surveyor wrote this.' },
    { id: 'p2', caption: '  ' },
    { id: 'p3', caption: null },
  ];

  it('never overwrites a surveyor caption', () => {
    const applied = applyCaptionsIfEmpty(photos, [
      { docId: 'p1', caption: 'Model wants to replace this.' },
      { docId: 'p2', caption: 'Stiff sash to the landing.' },
      { docId: 'p3', caption: 'Hairline crack to the cill.' },
      { docId: 'unknown', caption: 'Ignore me.' },
    ]);

    expect(applied.get('p1')).toBeUndefined();
    expect(applied.get('p2')).toBe('Stiff sash to the landing.');
    expect(applied.get('p3')).toBe('Hairline crack to the cill.');
    expect(applied.has('unknown')).toBe(false);
  });
});
