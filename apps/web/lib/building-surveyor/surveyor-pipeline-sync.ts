import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  type BuildingSurveyorPipelineStage,
  surveyorStageOnAccepted,
  surveyorStageOnQuoteSent,
} from './pipeline-stages';

export async function isBuildingSurveyorAccount(
  accountId: string,
): Promise<boolean> {
  const admin = getSupabaseServerAdminClient();
  const { data } = await admin
    .from('accounts')
    .select('space_type')
    .eq('id', accountId)
    .maybeSingle();
  return data?.space_type === 'building-surveyor';
}

export async function moveSurveyorDealStage(input: {
  accountId: string;
  dealId: string | null | undefined;
  stage: BuildingSurveyorPipelineStage;
}): Promise<boolean> {
  if (!input.dealId) return false;
  if (!(await isBuildingSurveyorAccount(input.accountId))) return false;

  const admin = getSupabaseServerAdminClient();
  const { error } = await admin
    .from('pipeline_deals')
    .update({ stage: input.stage })
    .eq('id', input.dealId)
    .eq('account_id', input.accountId);
  return !error;
}

async function logAutomaticTick(input: {
  accountId: string;
  dealId: string;
  tick: string;
}) {
  const admin = getSupabaseServerAdminClient();
  // pipeline_deal_events is newer than the generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('pipeline_deal_events').insert({
    account_id: input.accountId,
    deal_id: input.dealId,
    event_type: 'tick_changed',
    detail: { tick: input.tick, value: true },
    actor_id: null,
  });
  if (error) {
    console.error('[surveyor-pipeline-sync] tick event failed', error.message);
  }
}

/** Sending the quote moves the lead to Quote sent and ticks Email. */
export async function maybeMoveSurveyorDealOnQuoteSent(
  accountId: string,
  dealId: string | null | undefined,
) {
  const moved = await moveSurveyorDealStage({
    accountId,
    dealId,
    stage: surveyorStageOnQuoteSent(),
  });
  if (moved && dealId) {
    await setAutomaticTick({
      accountId,
      dealId,
      column: 'quote_sent_by_email',
      tick: 'quoteSentByEmail',
    });
  }
  return moved;
}

/** Turns a tick on once and logs it; a tick that is already on is left alone. */
async function setAutomaticTick(input: {
  accountId: string;
  dealId: string;
  column: string;
  tick: string;
  extra?: Record<string, unknown>;
}): Promise<boolean> {
  const admin = getSupabaseServerAdminClient();
  const now = new Date().toISOString();
  // Tick columns are newer than the generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('pipeline_deals')
    .update({ [input.column]: true, last_activity_at: now, ...input.extra })
    .eq('id', input.dealId)
    .eq('account_id', input.accountId)
    .eq(input.column, false)
    .select('id');
  if (error) return false;
  if ((data ?? []).length > 0) {
    await logAutomaticTick(input);
  }
  return true;
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

/**
 * A signed Terms of business ticks Signed on the lead. The stage is left
 * where it is, so a lead further along is never moved back.
 * Only contracts flagged is_terms_of_business count.
 */
export async function maybeMarkSurveyorTermsSigned(
  accountId: string,
  dealId: string | null | undefined,
  options?: { isTermsOfBusiness?: boolean | null },
): Promise<boolean> {
  if (!dealId) return false;
  if (options?.isTermsOfBusiness === false) return false;
  if (!(await isBuildingSurveyorAccount(accountId))) return false;
  if (options?.isTermsOfBusiness !== true) {
    // When the caller omits the flag, look up the contract is not available
    // here — require an explicit true from the sign completion path.
    return false;
  }
  return setAutomaticTick({
    accountId,
    dealId,
    column: 'tob_signed',
    tick: 'tobSigned',
    extra: { tob_signed_at: new Date().toISOString() },
  });
}
