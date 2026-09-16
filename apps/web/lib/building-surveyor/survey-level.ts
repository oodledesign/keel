/**
 * L2 and L3 share one section / template catalogue.
 * Level 3 only reveals extra optional detail fields — it does not fork a second shell.
 */
export const SURVEY_LEVELS = ['l2', 'l3'] as const;

export type SurveyLevel = (typeof SURVEY_LEVELS)[number];

export function isSurveyLevel(
  value: string | null | undefined,
): value is SurveyLevel {
  return value === 'l2' || value === 'l3';
}

export function surveyLevelForType(
  surveyType: string | null | undefined,
): SurveyLevel {
  return surveyType === 'rics_hss_l3' ? 'l3' : 'l2';
}

export function surveyLevelLabel(level: SurveyLevel): string {
  return level === 'l3' ? 'Level 3' : 'Level 2';
}
