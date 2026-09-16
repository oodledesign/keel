import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BUILDING_SURVEY_TYPE,
  DEFAULT_SURVEY_LEVEL,
  buildingSurveyTypeLabel,
  isBuildingSurveyTypeKey,
  isSurveyLevel,
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

  it('treats survey_level 2 | 3 as the v2 visibility driver', () => {
    expect(isSurveyLevel(2)).toBe(true);
    expect(isSurveyLevel(3)).toBe(true);
    expect(isSurveyLevel('3')).toBe(false);
    expect(isSurveyLevel(1)).toBe(false);
    expect(normalizeSurveyLevel('l3')).toBe(3);
    expect(normalizeSurveyLevel(null)).toBe(DEFAULT_SURVEY_LEVEL);
    expect(surveyLevelFromType('rics_hss_l3')).toBe(3);
    expect(surveyLevelFromType('rics_hss_l2')).toBe(2);
    expect(surveyTypeForLevel(3)).toBe('rics_hss_l3');
    expect(surveyTypeForLevel(2)).toBe('rics_hss_l2');
  });
});
