import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUILDING_SURVEY_TYPE,
  buildingSurveyTypeLabel,
  isBuildingSurveyTypeKey,
  normalizeBuildingSurveyType,
  normalizeSurveyLevel,
  surveyLevelFromType,
  surveyTypeForLevel,
} from './survey-types';

describe('building survey types', () => {
  it('accepts known template keys', () => {
    expect(isBuildingSurveyTypeKey('rics_hss_l2')).toBe(true);
    expect(isBuildingSurveyTypeKey('dilapidations')).toBe(true);
    expect(isBuildingSurveyTypeKey('unknown')).toBe(false);
  });

  it('falls back to Level 2 for missing or unknown keys', () => {
    expect(normalizeBuildingSurveyType(null)).toBe(
      DEFAULT_BUILDING_SURVEY_TYPE,
    );
    expect(normalizeBuildingSurveyType('not-a-template')).toBe('rics_hss_l2');
    expect(buildingSurveyTypeLabel('rics_hss_l3')).toBe(
      'RICS Home Survey Level 3',
    );
  });

  it('dual-writes survey level onto the shared template keys', () => {
    expect(normalizeSurveyLevel(3)).toBe(3);
    expect(normalizeSurveyLevel('l3')).toBe(3);
    expect(surveyLevelFromType('rics_hss_l3')).toBe(3);
    expect(surveyLevelFromType('dilapidations')).toBe(2);
    expect(surveyTypeForLevel(3)).toBe('rics_hss_l3');
    expect(surveyTypeForLevel(2)).toBe('rics_hss_l2');
  });
});
