/**
 * Thin survey template keys. L2 and L3 share one RICS Home Survey template;
 * `survey_level` is the visibility driver (see survey-section-catalogue.ts).
 * `survey_type` stays for dual-write until commercial / specialist templates
 * return. EPC and flood prefill land in Energy (J) and About the property.
 */
export const BUILDING_SURVEY_TYPES = [
  {
    key: 'rics_hss_l1',
    label: 'RICS Home Survey Level 1',
  },
  {
    key: 'rics_hss_l2',
    label: 'RICS Home Survey Level 2',
  },
  {
    key: 'rics_hss_l3',
    label: 'RICS Home Survey Level 3',
  },
  {
    key: 'commercial_condition',
    label: 'Commercial condition',
  },
  {
    key: 'dilapidations',
    label: 'Dilapidations',
  },
  {
    key: 'ppm',
    label: 'Planned preventative maintenance',
  },
  {
    key: 'fire_risk',
    label: 'Fire risk assessment',
  },
  {
    key: 'party_wall',
    label: 'Party wall',
  },
  {
    key: 'structural',
    label: 'Structural',
  },
] as const;

export type BuildingSurveyTypeKey =
  (typeof BUILDING_SURVEY_TYPES)[number]['key'];

export const DEFAULT_BUILDING_SURVEY_TYPE: BuildingSurveyTypeKey =
  'rics_hss_l2';

export function isBuildingSurveyTypeKey(
  value: string | null | undefined,
): value is BuildingSurveyTypeKey {
  return Boolean(
    value && BUILDING_SURVEY_TYPES.some((item) => item.key === value),
  );
}

export function buildingSurveyTypeLabel(
  value: string | null | undefined,
): string {
  const match = BUILDING_SURVEY_TYPES.find((item) => item.key === value);
  return match?.label ?? BUILDING_SURVEY_TYPES[1].label;
}

export function normalizeBuildingSurveyType(
  value: string | null | undefined,
): BuildingSurveyTypeKey {
  return isBuildingSurveyTypeKey(value) ? value : DEFAULT_BUILDING_SURVEY_TYPE;
}

/** RICS Home Survey level. One template; level hides L2-only or L3-only fields. */
export const SURVEY_LEVELS = [2, 3] as const;

export type SurveyLevel = (typeof SURVEY_LEVELS)[number];

export const DEFAULT_SURVEY_LEVEL: SurveyLevel = 2;

export const HOME_SURVEY_LEVEL_OPTIONS = [
  { level: 2 as const, key: 'rics_hss_l2', label: 'Level 2' },
  { level: 3 as const, key: 'rics_hss_l3', label: 'Level 3' },
] as const;

export function isSurveyLevel(
  value: number | string | null | undefined,
): value is SurveyLevel {
  return value === 2 || value === 3;
}

export function normalizeSurveyLevel(
  value: number | string | null | undefined,
): SurveyLevel {
  if (value === 3 || value === '3' || value === 'l3' || value === 'L3') {
    return 3;
  }
  return DEFAULT_SURVEY_LEVEL;
}

/** Dual-write: map the Phase 1 template key onto the v2 visibility driver. */
export function surveyLevelFromType(
  surveyType: string | null | undefined,
): SurveyLevel {
  return surveyType === 'rics_hss_l3' ? 3 : DEFAULT_SURVEY_LEVEL;
}

export function surveyTypeForLevel(level: SurveyLevel): BuildingSurveyTypeKey {
  return level === 3 ? 'rics_hss_l3' : 'rics_hss_l2';
}

export function surveyLevelLabel(level: SurveyLevel): string {
  return level === 3 ? 'Level 3' : 'Level 2';
}
