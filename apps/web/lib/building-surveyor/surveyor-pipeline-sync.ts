import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type BuildingSurveyorPipelineStage,
  surveyorStageOnAccepted,
  surveyorStageOnQuoteSent,
} from './pipeline-stages';

function adminDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getSupabaseServerAdminClient() as any;
}

export async function isBuildingSurveyorAccount(
  accountId: string,
): Promise<boolean> {
  const admin = adminDb();
  const { data } = await admin
    .from('accounts')
    .select('space_type')
    .eq('id', accountId)
    .maybeSingle();
  return (
    (data as { space_type?: string | null } | null)?.space_type ===
    'building-surveyor'
  );
}

export async function moveSurveyorDealStage(input: {
  accountId: string;
  dealId: string | null | undefined;
  stage: BuildingSurveyorPipelineStage;
}): Promise<boolean> {
  if (!input.dealId) return false;
  if (!(await isBuildingSurveyorAccount(input.accountId))) return false;

  const admin = adminDb();
  const { error } = await admin
    .from('pipeline_deals')
    .update({ stage: input.stage })
    .eq('id', input.dealId)
    .eq('account_id', input.accountId);
  return !error;
}

export async function maybeMoveSurveyorDealOnQuoteSent(
  accountId: string,
  dealId: string | null | undefined,
) {
  return moveSurveyorDealStage({
    accountId,
    dealId,
    stage: surveyorStageOnQuoteSent(),
  });
}

export async function maybeMoveSurveyorDealOnAccepted(
  accountId: string,
  dealId: string | null | undefined,
) {
  return moveSurveyorDealStage({
    accountId,
    dealId,
    stage: surveyorStageOnAccepted(),
  });
}
