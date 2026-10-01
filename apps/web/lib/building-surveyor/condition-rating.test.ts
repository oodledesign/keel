import { describe, expect, it } from 'vitest';

import {
  hasMixedConditionRatings,
  sectionConditionRating,
} from './condition-rating';
import { documentFromObservations } from './survey-report-document';

describe('sectionConditionRating', () => {
  it('returns null when no note is rated', () => {
    expect(sectionConditionRating([])).toBeNull();
    expect(sectionConditionRating([null, undefined])).toBeNull();
  });

  it('picks the most serious rating regardless of note order', () => {
    expect(sectionConditionRating(['1', '3', '2'])).toBe('3');
    expect(sectionConditionRating(['1', '2'])).toBe('2');
    expect(sectionConditionRating([null, '1'])).toBe('1');
  });

  it('prefers a numeric rating over not inspected or not applicable', () => {
    expect(sectionConditionRating(['NA', 'NI', '1'])).toBe('1');
    expect(sectionConditionRating(['NA', 'NI'])).toBe('NI');
    expect(sectionConditionRating(['NA'])).toBe('NA');
  });
});

describe('hasMixedConditionRatings', () => {
  it('only flags more than one distinct rating', () => {
    expect(hasMixedConditionRatings(['2', '2', null])).toBe(false);
    expect(hasMixedConditionRatings([null, null])).toBe(false);
    expect(hasMixedConditionRatings(['2', '3'])).toBe(true);
  });
});

describe('section heading rating in the report', () => {
  it('does not let a milder first note hide a serious one', () => {
    const document = documentFromObservations([
      {
        sectionKey: 'chimney_stacks',
        body: 'Pointing is sound.',
        conditionRating: '1',
      },
      {
        sectionKey: 'chimney_stacks',
        body: 'Flaunching has failed.',
        conditionRating: '3',
      },
    ]);
    const heading = document.blocks.find(
      (block) =>
        block.type === 'heading' && block.sectionKey === 'chimney_stacks',
    );
    expect(heading).toMatchObject({ conditionRating: '3' });
  });
});
