import { describe, expect, it } from 'vitest';

import {
  BUILDING_SURVEY_SECTIONS,
  sectionsForSurveyType,
} from './report-sections';
import { surveyLevelForType, surveyLevelLabel } from './survey-level';
import {
  fieldsForSurveyType,
  isFieldVisibleAtLevel,
  levelOnlyFields,
} from './survey-template-fields';

describe('surveyLevelForType', () => {
  it('maps Level 3 only when the survey type is rics_hss_l3', () => {
    expect(surveyLevelForType('rics_hss_l3')).toBe('l3');
    expect(surveyLevelForType('rics_hss_l2')).toBe('l2');
    expect(surveyLevelForType('rics_hss_l1')).toBe('l2');
    expect(surveyLevelForType('commercial_condition')).toBe('l2');
    expect(surveyLevelForType(null)).toBe('l2');
    expect(surveyLevelLabel('l3')).toBe('Level 3');
  });
});

describe('L2/L3 shared template visibility', () => {
  it('keeps the shared core sections on both levels', () => {
    const l2 = new Set(sectionsForSurveyType('rics_hss_l2').map((s) => s.key));
    const l3 = new Set(sectionsForSurveyType('rics_hss_l3').map((s) => s.key));

    expect(l2.has('energy')).toBe(true);
    expect(l3.has('energy')).toBe(true);
    expect(l2.has('risks')).toBe(true);
    expect(l3.has('risks')).toBe(true);
    expect(l2.has('about_property')).toBe(true);
    expect(l3.has('about_property')).toBe(true);
  });

  it('shows Level 3 optional detail sections only on L3', () => {
    const l2 = new Set(sectionsForSurveyType('rics_hss_l2').map((s) => s.key));
    const l3 = new Set(sectionsForSurveyType('rics_hss_l3').map((s) => s.key));

    for (const key of [
      'construction_detail',
      'means_of_escape',
      'other_local_factors',
      'energy_heating',
      'energy_lighting',
      'energy_ventilation',
    ]) {
      expect(l2.has(key)).toBe(false);
      expect(l3.has(key)).toBe(true);
    }
  });

  it('shows valuation on L2 only', () => {
    const l2 = sectionsForSurveyType('rics_hss_l2').map((s) => s.key);
    const l3 = sectionsForSurveyType('rics_hss_l3').map((s) => s.key);
    expect(l2).toContain('valuation');
    expect(l3).not.toContain('valuation');
  });

  it('does not fork the catalogue into two shells', () => {
    const shared = BUILDING_SURVEY_SECTIONS.filter((section) => {
      const levels = section.levels ?? ['l2', 'l3'];
      return levels.includes('l2') && levels.includes('l3');
    });
    expect(shared.length).toBeGreaterThan(20);
    expect(sectionsForSurveyType('rics_hss_l2').length).toBeLessThan(
      BUILDING_SURVEY_SECTIONS.length,
    );
    expect(sectionsForSurveyType('rics_hss_l3').length).toBeLessThan(
      BUILDING_SURVEY_SECTIONS.length,
    );
  });
});

describe('template field visibility', () => {
  it('exposes extra optional detail fields on Level 3 only', () => {
    const l2Keys = fieldsForSurveyType('rics_hss_l2').map((f) => f.key);
    const l3Keys = fieldsForSurveyType('rics_hss_l3').map((f) => f.key);

    expect(l2Keys).toContain('flood_zone');
    expect(l2Keys).toContain('epc_current_rating');
    expect(l2Keys).toContain('valuation_notes');
    expect(l2Keys).not.toContain('construction_form');
    expect(l2Keys).not.toContain('means_of_escape_notes');

    expect(l3Keys).toContain('construction_form');
    expect(l3Keys).toContain('age_band');
    expect(l3Keys).toContain('energy_heating_detail');
    expect(l3Keys).not.toContain('valuation_notes');

    expect(isFieldVisibleAtLevel('construction_form', 'l2')).toBe(false);
    expect(isFieldVisibleAtLevel('construction_form', 'l3')).toBe(true);
    expect(levelOnlyFields('l3').every((field) => field.optional)).toBe(true);
  });
});
