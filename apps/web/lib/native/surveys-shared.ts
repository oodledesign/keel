import {
  BUILDING_SURVEY_TYPES,
  type BuildingSurveyTypeKey,
  DEFAULT_BUILDING_SURVEY_TYPE,
  type SurveyLevel,
  buildingSurveyTypeLabel,
  isSurveyLevel,
  normalizeBuildingSurveyType,
  surveyLevelFromType,
} from '~/lib/building-surveyor/survey-types';

import { NativeHttpError } from './http';
import type { NativeOnSiteSection } from './survey-sections';
import { isUuid } from './workspace-shared';

export type { NativeOnSiteSection } from './survey-sections';

/** Path A is building-surveyor only. Other workspace types stay on Meetings / Notes. */
export function workspaceShowsNativeSurveys(
  profile: string | null | undefined,
) {
  return profile === 'building_surveyor';
}

export const NATIVE_SURVEY_TYPES = BUILDING_SURVEY_TYPES.map((item) => ({
  slug: item.key,
  label: item.label,
}));

export type NativeSurveyType = {
  slug: BuildingSurveyTypeKey;
  label: string;
};

export type NativeSurvey = {
  id: string;
  title: string;
  workspace: string;
  status: string;
  survey_type: BuildingSurveyTypeKey;
  survey_type_label: string;
  survey_level: SurveyLevel;
  survey_property_address: string | null;
  survey_property_postcode: string | null;
  survey_uprn: string | null;
  survey_flood_risk_band: string | null;
  survey_flood_risk_summary: string | null;
  client_id: string | null;
  client_name: string | null;
  session_count: number;
  photo_count: number;
  pending_local?: boolean;
  created_at: string;
  updated_at: string;
};

export type NativeSurveySession = {
  id: string;
  title: string;
  content: string;
  duration_seconds: number | null;
  source: string | null;
  meeting_date: string | null;
  created_at: string;
  rics_code: string | null;
  section_key: string | null;
};

export type NativeSurveyPhoto = {
  id: string;
  title: string;
  mime_type: string | null;
  created_at: string | null;
  preview_url: string | null;
  rics_code: string | null;
  section_key: string | null;
};

export type NativeSurveyDetail = NativeSurvey & {
  sessions: NativeSurveySession[];
  photos: NativeSurveyPhoto[];
  sections: NativeOnSiteSection[];
};

export type NativeSurveyRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  survey_type?: string | null;
  survey_level?: number | string | null;
  survey_property_address?: string | null;
  survey_property_postcode?: string | null;
  survey_uprn?: string | null;
  survey_flood_risk_band?: string | null;
  survey_flood_risk_summary?: string | null;
  client_id?: string | null;
  created_at: string;
  updated_at: string;
};

export function parseNativeSurveyType(
  value: string | null | undefined,
): BuildingSurveyTypeKey {
  if (value == null || value.trim() === '') {
    return DEFAULT_BUILDING_SURVEY_TYPE;
  }
  return normalizeBuildingSurveyType(value.trim());
}

export function parseNativeSurveyId(value: string | null | undefined): string {
  const id = value?.trim() ?? '';
  if (!isUuid(id)) {
    throw new NativeHttpError(404, 'Survey not found');
  }
  return id;
}

export function mapNativeSurvey(
  row: NativeSurveyRow,
  workspaceSlug: string,
  extras?: {
    clientName?: string | null;
    sessionCount?: number;
    photoCount?: number;
  },
): NativeSurvey {
  const surveyType = parseNativeSurveyType(row.survey_type);
  return {
    id: row.id,
    title: row.title?.trim() || 'Building survey',
    workspace: workspaceSlug,
    status: row.status?.trim() || 'draft',
    survey_type: surveyType,
    survey_type_label: buildingSurveyTypeLabel(surveyType),
    survey_level: isSurveyLevel(row.survey_level)
      ? row.survey_level
      : surveyLevelFromType(surveyType),
    survey_property_address: row.survey_property_address?.trim() || null,
    survey_property_postcode: row.survey_property_postcode?.trim() || null,
    survey_uprn: row.survey_uprn?.trim() || null,
    survey_flood_risk_band: row.survey_flood_risk_band?.trim() || null,
    survey_flood_risk_summary: row.survey_flood_risk_summary?.trim() || null,
    client_id: row.client_id?.trim() || null,
    client_name: extras?.clientName?.trim() || null,
    session_count: extras?.sessionCount ?? 0,
    photo_count: extras?.photoCount ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
