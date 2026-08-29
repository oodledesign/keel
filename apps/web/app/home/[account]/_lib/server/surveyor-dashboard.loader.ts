import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { BUILDING_SURVEYOR_PIPELINE_STAGES } from '~/lib/building-surveyor/pipeline-stages';

import { loadTeamWorkspace } from './team-account-workspace.loader';
import { redirectIfSpaceNotIn } from './workspace-route-guard';

export type SurveyorDashboardSurvey = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  clientName: string | null;
};

export type SurveyorDashboardData = {
  accountId: string;
  accountSlug: string;
  enquiryCount: number;
  bookedCount: number;
  surveyedCount: number;
  openEnquiryCount: number;
  recentSurveys: SurveyorDashboardSurvey[];
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
      .select('id, stage')
      .eq('account_id', accountId),
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

  const deals = (dealsResult.data ?? []) as Array<{ stage: string }>;
  const enquiryCount = deals.filter((deal) => deal.stage === 'enquiry').length;
  const bookedCount = deals.filter((deal) => deal.stage === 'booked').length;
  const surveyedCount = deals.filter(
    (deal) => deal.stage === 'surveyed',
  ).length;
  const openEnquiryCount = deals.filter((deal) =>
    (BUILDING_SURVEYOR_PIPELINE_STAGES as readonly string[]).includes(
      deal.stage,
    )
      ? deal.stage !== 'reported' && deal.stage !== 'lost'
      : false,
  ).length;

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
    openEnquiryCount,
    recentSurveys,
  };
}
