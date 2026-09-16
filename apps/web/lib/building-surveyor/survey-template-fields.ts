import {
  type SurveyLevel,
  surveyLevelForType,
} from '~/lib/building-surveyor/survey-level';

/**
 * Shared RICS Home Survey field catalogue.
 * L2 and L3 use this one list; Level 3 exposes extra optional detail fields.
 */
export type SurveyTemplateField = {
  key: string;
  sectionKey: string;
  label: string;
  levels: readonly SurveyLevel[];
  optional: boolean;
};

export const SURVEY_TEMPLATE_FIELDS: readonly SurveyTemplateField[] = [
  {
    key: 'property_address',
    sectionKey: 'about_property',
    label: 'Property address',
    levels: ['l2', 'l3'],
    optional: false,
  },
  {
    key: 'property_postcode',
    sectionKey: 'about_property',
    label: 'Postcode',
    levels: ['l2', 'l3'],
    optional: false,
  },
  {
    key: 'property_uprn',
    sectionKey: 'about_property',
    label: 'UPRN',
    levels: ['l2', 'l3'],
    optional: true,
  },
  {
    key: 'epc_current_rating',
    sectionKey: 'energy',
    label: 'Current EPC rating',
    levels: ['l2', 'l3'],
    optional: false,
  },
  {
    key: 'epc_potential_rating',
    sectionKey: 'energy',
    label: 'Potential EPC rating',
    levels: ['l2', 'l3'],
    optional: false,
  },
  {
    key: 'epc_floor_area',
    sectionKey: 'about_property',
    label: 'Floor area',
    levels: ['l2', 'l3'],
    optional: true,
  },
  {
    key: 'epc_fuel_type',
    sectionKey: 'about_property',
    label: 'Fuel / heating',
    levels: ['l2', 'l3'],
    optional: true,
  },
  {
    key: 'flood_zone',
    sectionKey: 'risks',
    label: 'Flood zone',
    levels: ['l2', 'l3'],
    optional: false,
  },
  {
    key: 'flood_rivers_and_sea',
    sectionKey: 'risks',
    label: 'Rivers and sea risk',
    levels: ['l2', 'l3'],
    optional: true,
  },
  {
    key: 'valuation_notes',
    sectionKey: 'valuation',
    label: 'Valuation',
    levels: ['l2'],
    optional: true,
  },
  {
    key: 'construction_form',
    sectionKey: 'construction_detail',
    label: 'Construction form',
    levels: ['l3'],
    optional: true,
  },
  {
    key: 'age_band',
    sectionKey: 'construction_detail',
    label: 'Age band',
    levels: ['l3'],
    optional: true,
  },
  {
    key: 'accommodation_schedule',
    sectionKey: 'construction_detail',
    label: 'Accommodation schedule',
    levels: ['l3'],
    optional: true,
  },
  {
    key: 'means_of_escape_notes',
    sectionKey: 'means_of_escape',
    label: 'Means of escape',
    levels: ['l3'],
    optional: true,
  },
  {
    key: 'other_local_factors_notes',
    sectionKey: 'other_local_factors',
    label: 'Other local factors',
    levels: ['l3'],
    optional: true,
  },
  {
    key: 'energy_heating_detail',
    sectionKey: 'energy_heating',
    label: 'Heating efficiency notes',
    levels: ['l3'],
    optional: true,
  },
  {
    key: 'energy_lighting_detail',
    sectionKey: 'energy_lighting',
    label: 'Lighting efficiency notes',
    levels: ['l3'],
    optional: true,
  },
  {
    key: 'energy_ventilation_detail',
    sectionKey: 'energy_ventilation',
    label: 'Ventilation notes',
    levels: ['l3'],
    optional: true,
  },
] as const;

export function fieldsForSurveyLevel(
  level: SurveyLevel,
): SurveyTemplateField[] {
  return SURVEY_TEMPLATE_FIELDS.filter((field) => field.levels.includes(level));
}

export function fieldsForSurveyType(
  surveyType: string | null | undefined,
): SurveyTemplateField[] {
  return fieldsForSurveyLevel(surveyLevelForType(surveyType));
}

export function isFieldVisibleAtLevel(
  fieldKey: string,
  level: SurveyLevel,
): boolean {
  const field = SURVEY_TEMPLATE_FIELDS.find((item) => item.key === fieldKey);
  if (!field) return false;
  return field.levels.includes(level);
}

export function levelOnlyFields(level: SurveyLevel): SurveyTemplateField[] {
  return fieldsForSurveyLevel(level).filter(
    (field) => field.levels.length === 1,
  );
}
