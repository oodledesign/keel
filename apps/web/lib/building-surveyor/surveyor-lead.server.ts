import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  BUILDING_SURVEYOR_PIPELINE_LOST_STAGE,
  SURVEYOR_TOB_REQUIRED_MESSAGE,
  isBuildingSurveyorPipelineStage,
  surveyorStageBlockedByTob,
} from './pipeline-stages';
import {
  SURVEYOR_LEAD_SELECT,
  type SurveyorLeadFields,
  type SurveyorLeadInput,
  type SurveyorLeadRow,
  type SurveyorPipelineSettings,
  type SurveyorTickChange,
  type SurveyorTickInput,
  mapSurveyorLeadRow,
  normalizeSurveyorPipelineSettings,
  resolveSurveyorTickUpdate,
  surveyorLeadInputToColumns,
} from './surveyor-lead';

// Lead columns and pipeline_deal_events are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>;

async function accountIsBuildingSurveyor(
  client: AnyClient,
  accountId: string | null | undefined,
): Promise<boolean> {
  if (!accountId) return false;
  const { data } = await client
    .from('accounts')
    .select('space_type')
    .eq('id', accountId)
    .maybeSingle();
  return (
    (data as { space_type?: string | null } | null)?.space_type ===
    'building-surveyor'
  );
}

/**
 * Terms of business gate. Returns an error message when a building-surveyor
 * lead cannot move to `stage` yet, otherwise null. Stage keys outside the
 * surveyor gate return null without touching the database.
 */
export async function surveyorTobGateError(input: {
  client: AnyClient;
  dealId: string;
  stage: string | null | undefined;
  /** The ToB tick being saved in the same update, if any. */
  tobSignedOverride?: boolean;
}): Promise<string | null> {
  if (!surveyorStageBlockedByTob(input.stage, false)) return null;
  if (input.tobSignedOverride === true) return null;

  const { data } = await input.client
    .from('pipeline_deals')
    .select('account_id, tob_signed')
    .eq('id', input.dealId)
    .maybeSingle();
  const row = data as {
    account_id?: string | null;
    tob_signed?: boolean | null;
  } | null;
  if (!row) return null;
  if (!(await accountIsBuildingSurveyor(input.client, row.account_id))) {
    return null;
  }
  const signed =
    input.tobSignedOverride === false ? false : Boolean(row.tob_signed);
  return surveyorStageBlockedByTob(input.stage, signed)
    ? SURVEYOR_TOB_REQUIRED_MESSAGE
    : null;
}

/**
 * `lost_at` for a building-surveyor stage move: stamped when a lead moves to
 * Lost and cleared when it is reopened. Other workspaces get no columns.
 */
export async function surveyorStageColumns(input: {
  client: AnyClient;
  dealId: string;
  stage: string | null | undefined;
}): Promise<Record<string, string | null>> {
  if (!input.stage || !isBuildingSurveyorPipelineStage(input.stage)) return {};

  const { data } = await input.client
    .from('pipeline_deals')
    .select('account_id, lost_at')
    .eq('id', input.dealId)
    .maybeSingle();
  const row = data as {
    account_id?: string | null;
    lost_at?: string | null;
  } | null;
  if (
    !row ||
    !(await accountIsBuildingSurveyor(input.client, row.account_id))
  ) {
    return {};
  }
  if (input.stage === BUILDING_SURVEYOR_PIPELINE_LOST_STAGE) {
    return row.lost_at ? {} : { lost_at: new Date().toISOString() };
  }
  return row.lost_at ? { lost_at: null } : {};
}

export type SurveyorLeadPatch = {
  accountId: string;
  columns: Record<string, unknown>;
  changes: SurveyorTickChange[];
};

/**
 * Column patch for surveyor lead fields and ticks. Returns null when the deal
 * is not on a building-surveyor account, so other workspaces are unaffected.
 */
export async function resolveSurveyorLeadPatch(input: {
  client: AnyClient;
  dealId: string;
  userId: string;
  lead?: SurveyorLeadInput;
  ticks?: SurveyorTickInput;
}): Promise<SurveyorLeadPatch | null> {
  if (!input.lead && !input.ticks) return null;

  const { data } = await input.client
    .from('pipeline_deals')
    .select(`account_id, ${SURVEYOR_LEAD_SELECT}`)
    .eq('id', input.dealId)
    .maybeSingle();
  const row = data as (SurveyorLeadRow & { account_id?: string | null }) | null;
  if (!row?.account_id) return null;
  if (!(await accountIsBuildingSurveyor(input.client, row.account_id))) {
    return null;
  }

  const now = new Date().toISOString();
  const ticks = resolveSurveyorTickUpdate({
    current: mapSurveyorLeadRow(row),
    next: input.ticks,
    userId: input.userId,
    now,
  });
  const columns: Record<string, unknown> = {
    ...surveyorLeadInputToColumns(input.lead),
    ...ticks.columns,
  };
  if (Object.keys(columns).length > 0) {
    columns.last_activity_at = now;
  }
  return { accountId: row.account_id, columns, changes: ticks.changes };
}

export async function logSurveyorTickEvents(input: {
  client: AnyClient;
  accountId: string;
  dealId: string;
  actorId: string | null;
  changes: SurveyorTickChange[];
}) {
  if (input.changes.length === 0) return;
  const { error } = await input.client.from('pipeline_deal_events').insert(
    input.changes.map((change) => ({
      account_id: input.accountId,
      deal_id: input.dealId,
      event_type: 'tick_changed',
      detail: change,
      actor_id: input.actorId,
    })),
  );
  if (error) {
    console.error('[surveyor-lead] tick event insert failed', error.message);
  }
}

/** Surveyor lead fields for every deal on the account, keyed by deal id. */
export async function loadSurveyorLeadsForAccount(
  client: AnyClient,
  accountId: string,
): Promise<Record<string, SurveyorLeadFields>> {
  const { data, error } = await client
    .from('pipeline_deals')
    .select(SURVEYOR_LEAD_SELECT)
    .eq('account_id', accountId);
  if (error) {
    console.error('[surveyor-lead] load failed', error.message);
    return {};
  }
  const out: Record<string, SurveyorLeadFields> = {};
  for (const row of (data ?? []) as SurveyorLeadRow[]) {
    out[row.id] = mapSurveyorLeadRow(row);
  }
  return out;
}

export async function loadSurveyorPipelineSettings(
  client: AnyClient,
  accountId: string,
): Promise<SurveyorPipelineSettings> {
  const { data, error } = await client
    .from('survey_account_settings')
    .select(
      'lead_amber_days, lead_red_days, lead_archive_days, quote_reminder_days, quote_reminder_client_email',
    )
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) {
    console.error('[surveyor-lead] settings load failed', error.message);
  }
  return normalizeSurveyorPipelineSettings(error ? null : data);
}

export type SurveyorMemberOption = { id: string; name: string };

/** Workspace members for the Surveyor and "Checked by" selects. */
export async function loadSurveyorMemberOptions(
  client: AnyClient,
  accountId: string,
): Promise<SurveyorMemberOption[]> {
  const { data: memberships } = await client
    .from('accounts_memberships')
    .select('user_id')
    .eq('account_id', accountId);
  const ids = [
    ...new Set(
      ((memberships ?? []) as Array<{ user_id: string }>).map(
        (row) => row.user_id,
      ),
    ),
  ];
  if (ids.length === 0) return [];
  const { data: accounts } = await client
    .from('accounts')
    .select('id, name, email')
    .in('id', ids);
  return (
    (accounts ?? []) as Array<{
      id: string;
      name: string | null;
      email: string | null;
    }>
  )
    .map((row) => ({
      id: row.id,
      name: row.name?.trim() || row.email?.trim() || 'Member',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
