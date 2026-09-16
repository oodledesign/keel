import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  BUILDING_SURVEYOR_PIPELINE_LABELS,
  BUILDING_SURVEYOR_PIPELINE_STAGES,
  type BuildingSurveyorPipelineStage,
  isBuildingSurveyorTerminalStage,
} from '~/lib/building-surveyor/pipeline-stages';

import type {
  NativeSurveyorHome,
  NativeSurveyorHomeDeal,
  NativeSurveyorHomeSurvey,
} from './surveyor-home-shared';
import { workspaceShowsNativeSurveys } from './surveys-shared';
import type { NativeWorkspace } from './workspace-shared';

export type {
  NativeSurveyorHome,
  NativeSurveyorHomeDeal,
  NativeSurveyorHomeSurvey,
} from './surveyor-home-shared';
export { emptyNativeSurveyorHome } from './surveyor-home-shared';

type DealRow = {
  id: string;
  name: string | null;
  stage: string;
  contact_name: string | null;
  company_name: string | null;
  clients: { display_name: string | null } | null;
};

type SurveyRow = {
  id: string;
  title: string | null;
  status: string;
  updated_at: string;
  clients: { display_name: string | null } | null;
};

export async function loadNativeSurveyorHome(
  client: SupabaseClient,
  workspace: NativeWorkspace,
): Promise<NativeSurveyorHome | null> {
  if (!workspaceShowsNativeSurveys(workspace.profile)) {
    return null;
  }

  // Surveyor columns may lag generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const [dealsResult, surveysResult] = await Promise.all([
    db
      .from('pipeline_deals')
      .select(
        'id, name, stage, contact_name, company_name, updated_at, clients(display_name)',
      )
      .eq('account_id', workspace.id)
      .order('updated_at', { ascending: false }),
    db
      .from('proposals')
      .select('id, title, status, updated_at, clients(display_name)')
      .eq('account_id', workspace.id)
      .eq('kind', 'survey_report')
      .order('updated_at', { ascending: false })
      .limit(6),
  ]);

  if (dealsResult.error) {
    throw new Error(dealsResult.error.message);
  }
  if (surveysResult.error) {
    throw new Error(surveysResult.error.message);
  }

  const deals = (dealsResult.data ?? []) as DealRow[];
  const knownStages = BUILDING_SURVEYOR_PIPELINE_STAGES as readonly string[];
  const openDeals = deals.filter((deal) =>
    knownStages.includes(deal.stage)
      ? !isBuildingSurveyorTerminalStage(deal.stage)
      : false,
  );

  const pipeline: NativeSurveyorHomeDeal[] = openDeals
    .slice(0, 8)
    .map((deal) => {
      const stage = deal.stage as BuildingSurveyorPipelineStage;
      return {
        id: deal.id,
        title:
          deal.name?.trim() ||
          deal.company_name?.trim() ||
          deal.contact_name?.trim() ||
          'Untitled',
        stage: deal.stage,
        stage_label: BUILDING_SURVEYOR_PIPELINE_LABELS[stage] ?? deal.stage,
        client_name:
          deal.clients?.display_name?.trim() ||
          deal.contact_name?.trim() ||
          null,
      };
    });

  const recent_surveys: NativeSurveyorHomeSurvey[] = (
    (surveysResult.data ?? []) as SurveyRow[]
  ).map((row) => ({
    id: row.id,
    title: row.title?.trim() || 'Untitled survey',
    status: row.status,
    updated_at: row.updated_at,
    client_name: row.clients?.display_name?.trim() || null,
  }));

  return {
    open_count: openDeals.length,
    enquiry_count: deals.filter((deal) => deal.stage === 'enquiry').length,
    booked_count: deals.filter((deal) => deal.stage === 'booked').length,
    surveyed_count: deals.filter((deal) => deal.stage === 'surveyed').length,
    recent_surveys,
    pipeline,
  };
}
