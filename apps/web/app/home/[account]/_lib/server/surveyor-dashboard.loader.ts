import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  BUILDING_SURVEYOR_PIPELINE_LABELS,
  BUILDING_SURVEYOR_PIPELINE_STAGES,
  type BuildingSurveyorPipelineStage,
  isBuildingSurveyorTerminalStage,
} from '~/lib/building-surveyor/pipeline-stages';

import { loadTeamWorkspace } from './team-account-workspace.loader';
import { redirectIfSpaceNotIn } from './workspace-route-guard';

export type SurveyorDashboardSurvey = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  clientName: string | null;
};

export type SurveyorDashboardDeal = {
  id: string;
  title: string;
  stage: string;
  stageLabel: string;
  clientName: string | null;
};

export type SurveyorDashboardData = {
  accountId: string;
  accountSlug: string;
  enquiryCount: number;
  bookedCount: number;
  surveyedCount: number;
  openPipelineCount: number;
  recentSurveys: SurveyorDashboardSurvey[];
  pipelineDeals: SurveyorDashboardDeal[];
};

export const loadSurveyorDashboardData = cache(loadSurveyorDashboardDataImpl);

async function loadSurveyorDashboardDataImpl(
  accountSlug: string,
): Promise<SurveyorDashboardData> {
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['building-surveyor']);

  const accountId = workspace.account.id as string;
  // `kind` / surveyor columns may lag generated Database types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabaseServerClient() as any;

  const [dealsResult, surveysResult] = await Promise.all([
    client
      .from('pipeline_deals')
      .select(
        'id, name, stage, contact_name, company_name, updated_at, clients(display_name)',
      )
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false }),
    client
      .from('proposals')
      .select('id, title, status, updated_at, clients(display_name)')
      .eq('account_id', accountId)
      .eq('kind', 'survey_report')
      .order('updated_at', { ascending: false })
      .limit(6),
  ]);

  if (dealsResult.error) throw new Error(dealsResult.error.message);
  if (surveysResult.error) throw new Error(surveysResult.error.message);

  type DealRow = {
    id: string;
    name: string | null;
    stage: string;
    contact_name: string | null;
    company_name: string | null;
    clients: { display_name: string | null } | null;
  };

  const deals = (dealsResult.data ?? []) as DealRow[];
  const enquiryCount = deals.filter((deal) => deal.stage === 'enquiry').length;
  const bookedCount = deals.filter((deal) => deal.stage === 'booked').length;
  const surveyedCount = deals.filter(
    (deal) => deal.stage === 'surveyed',
  ).length;
  const openDeals = deals.filter((deal) =>
    (BUILDING_SURVEYOR_PIPELINE_STAGES as readonly string[]).includes(
      deal.stage,
    )
      ? !isBuildingSurveyorTerminalStage(deal.stage)
      : false,
  );
  const openPipelineCount = openDeals.length;

  const pipelineDeals: SurveyorDashboardDeal[] = openDeals
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
        stageLabel: BUILDING_SURVEYOR_PIPELINE_LABELS[stage] ?? deal.stage,
        clientName:
          deal.clients?.display_name?.trim() ||
          deal.contact_name?.trim() ||
          null,
      };
    });

  const recentSurveys: SurveyorDashboardSurvey[] = (
    (surveysResult.data ?? []) as Array<{
      id: string;
      title: string | null;
      status: string;
      updated_at: string;
      clients: { display_name: string | null } | null;
    }>
  ).map((row) => ({
    id: row.id,
    title: row.title?.trim() || 'Untitled survey',
    status: row.status,
    updatedAt: row.updated_at,
    clientName: row.clients?.display_name?.trim() || null,
  }));

  return {
    accountId,
    accountSlug,
    enquiryCount,
    bookedCount,
    surveyedCount,
    openPipelineCount,
    recentSurveys,
    pipelineDeals,
  };
}
