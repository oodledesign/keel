import { describe, expect, it } from 'vitest';

import {
  SURVEY_SECTION_NOTE_DIVIDER,
  appendSurveySectionNote,
  joinSectionNoteBodies,
  planMergeSectionNotes,
  stripSurveySectionNoteDividers,
} from './merge-section-notes';

describe('stripSurveySectionNoteDividers', () => {
  it('replaces legacy em-dash dividers with blank lines', () => {
    expect(
      stripSurveySectionNoteDividers(
        `Stopcock is stiff.\n\n${SURVEY_SECTION_NOTE_DIVIDER}\n\nSupply is copper.`,
      ),
    ).toBe('Stopcock is stiff.\n\nSupply is copper.');
  });

  it('leaves plain notes alone', () => {
    expect(stripSurveySectionNoteDividers('Just a note.')).toBe('Just a note.');
  });
});

describe('appendSurveySectionNote', () => {
  it('appends with a blank line and no divider', () => {
    expect(
      appendSurveySectionNote(
        'Stopcock is stiff.',
        'Supply pipework is copper.',
      ),
    ).toBe('Stopcock is stiff.\n\nSupply pipework is copper.');
  });

  it('strips a legacy divider from the existing body first', () => {
    expect(
      appendSurveySectionNote(
        `A\n\n${SURVEY_SECTION_NOTE_DIVIDER}\n\nB`,
        'C',
      ),
    ).toBe('A\n\nB\n\nC');
  });
});

describe('joinSectionNoteBodies', () => {
  it('joins non-empty bodies with blank lines', () => {
    expect(joinSectionNoteBodies(['First', '', 'Second'])).toBe(
      'First\n\nSecond',
    );
  });
});

describe('planMergeSectionNotes', () => {
  it('keeps the first note and deletes the rest', () => {
    expect(
      planMergeSectionNotes({
        notes: [
          { id: 'a', body: 'One' },
          { id: 'b', body: 'Two' },
          { id: 'c', body: 'Three' },
        ],
        mergedBody: 'One\n\nTwo revised\n\nThree',
      }),
    ).toEqual({
      keepId: 'a',
      body: 'One\n\nTwo revised\n\nThree',
      deleteIds: ['b', 'c'],
    });
  });

  it('returns null when there are no notes', () => {
    expect(
      planMergeSectionNotes({ notes: [], mergedBody: 'Hello' }),
    ).toBeNull();
  });
});
