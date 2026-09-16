import { describe, expect, it } from 'vitest';

import {
  groupPhrasesBySectionCode,
  parsePhraseDrag,
  phraseBodiesAfterInsert,
  phraseInsertMode,
  phraseMatchesQuery,
  phraseToReportTextHtml,
  serializePhraseDrag,
} from './phrase-insert-blocks';

describe('phraseInsertMode', () => {
  it('fills an empty observation and otherwise opens a new block', () => {
    expect(phraseInsertMode('')).toBe('fill-empty');
    expect(phraseInsertMode('   ')).toBe('fill-empty');
    expect(phraseInsertMode('Existing note')).toBe('new-block');
  });
});

describe('phraseBodiesAfterInsert', () => {
  it('keeps each phrase as its own body and never merges paragraphs', () => {
    expect(
      phraseBodiesAfterInsert(['Roof covering is worn.'], 'Flashings leak.'),
    ).toEqual(['Roof covering is worn.', 'Flashings leak.']);
    expect(phraseBodiesAfterInsert([''], 'First phrase')).toEqual([
      'First phrase',
    ]);
    expect(phraseBodiesAfterInsert(['Keep me'], '  ')).toEqual(['Keep me']);
  });
});

describe('phraseToReportTextHtml', () => {
  it('renders one phrase as its own paragraph block', () => {
    expect(phraseToReportTextHtml('Flashings leak.')).toBe(
      '<p>Flashings leak.</p>',
    );
    expect(phraseToReportTextHtml('Line one\n\nLine two')).toBe(
      '<p>Line one</p><p>Line two</p>',
    );
  });
});

describe('groupPhrasesBySectionCode', () => {
  it('groups by short RICS codes such as F3', () => {
    const groups = groupPhrasesBySectionCode([
      { title: 'Tank', ricsCode: 'F3' },
      { title: 'Cistern', ricsCode: 'F3' },
      { title: 'Tiles', ricsCode: 'D2' },
    ]);
    expect(groups.map((group) => group.code)).toEqual(['F3', 'D2']);
    expect(groups[0]?.items).toHaveLength(2);
  });
});

describe('phraseMatchesQuery', () => {
  it('matches title, body, or short code', () => {
    const phrase = {
      title: 'Water tank',
      body: 'The cold water storage cistern…',
      ricsCode: 'F3',
    };
    expect(phraseMatchesQuery(phrase, 'f3')).toBe(true);
    expect(phraseMatchesQuery(phrase, 'cistern')).toBe(true);
    expect(phraseMatchesQuery(phrase, 'roof')).toBe(false);
  });
});

describe('phrase drag payload', () => {
  it('round-trips a valid payload and rejects junk', () => {
    const raw = serializePhraseDrag({
      title: 'Tiles',
      body: 'Coverings are slipped.',
      ricsCode: 'D2',
    });
    expect(parsePhraseDrag(raw)?.body).toBe('Coverings are slipped.');
    expect(parsePhraseDrag('not-json')).toBeNull();
    expect(parsePhraseDrag('{"title":"x"}')).toBeNull();
  });
});
