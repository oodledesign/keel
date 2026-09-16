/**
 * Thin survey template keys. L2 and L3 share one section / field catalogue;
 * Level 3 only reveals extra optional detail fields. EPC and flood prefill
 * land in Energy efficiency and Risks for every building-surveyor survey.
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
