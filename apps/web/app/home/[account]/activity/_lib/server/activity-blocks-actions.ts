'use server';

import { revalidatePath } from 'next/cache';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import { filterActivityBlocksForReport } from '~/lib/activity/activity-history';
import { getActivitySupabaseClient } from '~/lib/activity/activity-supabase';

type UpdateActivityBlockInput = {
  accountId: string;
  accountSlug: string;
  blockId: string;
  projectId?: string | null;
  clientId?: string | null;
  isConfirmed?: boolean;
  workClassification?: 'billable' | 'internal' | 'neutral';
};

type ExcludeActivityBlockInput = {
  accountId: string;
  accountSlug: string;
  blockId: string;
};

type BulkUpdateActivityBlocksInput = {
  accountId: string;
  accountSlug: string;
  blockIds: string[];
  projectId?: string | null;
  clientId?: string | null;
  isConfirmed?: boolean;
  workClassification?: 'billable' | 'internal' | 'neutral';
};

type BulkExcludeActivityBlocksInput = {
  accountId: string;
  accountSlug: string;
  blockIds: string[];
};

type AssignUnassignedReportFilterInput = {
  accountId: string;
  accountSlug: string;
  dateFrom: string;
  dateTo: string;
  filters: {
    clientId?: string | null;
    projectId?: string | null;
    memberId?: string | null;
    appKey?: string | null;
  };
  projectId?: string | null;
  clientId?: string | null;
  workClassification?: 'billable' | 'internal' | 'neutral';
  rememberRule?: boolean;
  ruleMatch?: {
    matchType: 'domain' | 'app_name' | 'title_contains' | 'url_path' | 'repo_name';
    matchValue: string;
  };
};

type CreateActivityRuleInput = {
  accountId: string;
  accountSlug: string;
  matchType: 'domain' | 'app_name' | 'title_contains' | 'url_path' | 'repo_name';
  matchValue: string;
  projectId?: string | null;
  clientId?: string | null;
  backfill?: boolean;
  dateFrom?: string | null;
  dateTo?: string | null;
};

async function revalidateActivityPaths(accountSlug: string) {
  revalidatePath(
    workAccountPath(pathsConfig.app.accountActivity, accountSlug),
    'page',
  );
  revalidatePath(
    workAccountPath(pathsConfig.app.accountActivityReports, accountSlug),
    'page',
  );
}

async function assertProjectBelongsToAccount(
  projectId: string,
  accountId: string,
) {
  const client = getActivitySupabaseClient();
  const { data, error } = await client
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Invalid project for this workspace');
  }
}

async function assertClientBelongsToAccount(
  clientId: string,
  accountId: string,
) {
  const client = getActivitySupabaseClient();
  const { data, error } = await client
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Invalid client for this workspace');
  }
}

export async function updateActivityBlockAction(
  input: UpdateActivityBlockInput,
): Promise<{ success: boolean; error?: string }> {
  const client = getActivitySupabaseClient();

  if (input.projectId) {
    await assertProjectBelongsToAccount(input.projectId, input.accountId);
  }

  if (input.clientId) {
    await assertClientBelongsToAccount(input.clientId, input.accountId);
  }

  const payload: Record<string, unknown> = {};

  if (input.projectId !== undefined) {
    payload.project_id = input.projectId;
  }

  if (input.clientId !== undefined) {
    payload.client_id = input.clientId;
  }

  if (input.isConfirmed !== undefined) {
    payload.is_confirmed = input.isConfirmed;
  }

  if (input.workClassification !== undefined) {
    payload.work_classification = input.workClassification;
  }

  if (Object.keys(payload).length === 0) {
    return { success: false, error: 'Nothing to update' };
  }

  const { error } = await client
    .from('activity_blocks')
    .update(payload)
    .eq('id', input.blockId)
    .eq('account_id', input.accountId);

  if (error) {
    return { success: false, error: error.message };
  }

  await revalidateActivityPaths(input.accountSlug);
  return { success: true };
}

export async function excludeActivityBlockAction(
  input: ExcludeActivityBlockInput,
): Promise<{ success: boolean; error?: string }> {
  const client = getActivitySupabaseClient();

  const { error } = await client
    .from('activity_blocks')
    .update({ is_excluded: true })
    .eq('id', input.blockId)
    .eq('account_id', input.accountId);

  if (error) {
    return { success: false, error: error.message };
  }

  await revalidateActivityPaths(input.accountSlug);
  return { success: true };
}

export async function bulkUpdateActivityBlocksAction(
  input: BulkUpdateActivityBlocksInput,
): Promise<{ success: boolean; error?: string }> {
  const blockIds = [...new Set(input.blockIds.map((id) => id.trim()).filter(Boolean))];

  if (blockIds.length === 0) {
    return { success: false, error: 'No activity blocks selected' };
  }

  if (input.projectId) {
    await assertProjectBelongsToAccount(input.projectId, input.accountId);
  }

  if (input.clientId) {
    await assertClientBelongsToAccount(input.clientId, input.accountId);
  }

  const payload: Record<string, unknown> = {};

  if (input.projectId !== undefined) {
    payload.project_id = input.projectId;
  }

  if (input.clientId !== undefined) {
    payload.client_id = input.clientId;
  }

  if (input.isConfirmed !== undefined) {
    payload.is_confirmed = input.isConfirmed;
  }

  if (input.workClassification !== undefined) {
    payload.work_classification = input.workClassification;
  }

  if (Object.keys(payload).length === 0) {
    return { success: false, error: 'Nothing to update' };
  }

  const client = getActivitySupabaseClient();
  const { error } = await client
    .from('activity_blocks')
    .update(payload)
    .in('id', blockIds)
    .eq('account_id', input.accountId);

  if (error) {
    return { success: false, error: error.message };
  }

  await revalidateActivityPaths(input.accountSlug);
  return { success: true };
}

export async function bulkExcludeActivityBlocksAction(
  input: BulkExcludeActivityBlocksInput,
): Promise<{ success: boolean; error?: string }> {
  const blockIds = [...new Set(input.blockIds.map((id) => id.trim()).filter(Boolean))];

  if (blockIds.length === 0) {
    return { success: false, error: 'No activity blocks selected' };
  }

  const client = getActivitySupabaseClient();
  const { error } = await client
    .from('activity_blocks')
    .update({ is_excluded: true })
    .in('id', blockIds)
    .eq('account_id', input.accountId);

  if (error) {
    return { success: false, error: error.message };
  }

  await revalidateActivityPaths(input.accountSlug);
  return { success: true };
}

export async function assignUnassignedReportFilterAction(
  input: AssignUnassignedReportFilterInput,
): Promise<{ success: boolean; updated?: number; error?: string }> {
  const client = getActivitySupabaseClient();
  const { data: auth } = await client.auth.getUser();
  const userId = auth.user?.id;

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!input.projectId && !input.clientId) {
    return { success: false, error: 'Choose a client or project' };
  }

  if (input.projectId) {
    await assertProjectBelongsToAccount(input.projectId, input.accountId);
  }

  if (input.clientId) {
    await assertClientBelongsToAccount(input.clientId, input.accountId);
  }

  const rangeStart = `${input.dateFrom}T00:00:00.000Z`;
  const rangeEnd = `${input.dateTo}T23:59:59.999Z`;

  const { data, error } = await client
    .from('activity_blocks')
    .select(
      `
        id,
        user_id,
        app_name,
        bundle_id,
        domain,
        url,
        window_title,
        started_at,
        ended_at,
        duration_seconds,
        project_id,
        client_id,
        confidence_score,
        is_confirmed,
        is_excluded
      `,
    )
    .eq('account_id', input.accountId)
    .eq('user_id', userId)
    .gte('started_at', rangeStart)
    .lte('started_at', rangeEnd)
    .eq('is_excluded', false)
    .limit(5000);

  if (error) {
    return { success: false, error: error.message };
  }

  const blocks = (data ?? []).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    userName: null,
    appName: row.app_name as string,
    bundleId: row.bundle_id as string,
    domain: (row.domain as string | null) ?? null,
    url: (row.url as string | null) ?? null,
    windowTitle: row.window_title as string,
    repoName: (row.repo_name as string | null) ?? null,
    startedAt: row.started_at as string,
    endedAt: row.ended_at as string,
    durationSeconds: row.duration_seconds as number,
    projectId: (row.project_id as string | null) ?? null,
    projectName: null,
    clientId: (row.client_id as string | null) ?? null,
    clientName: null,
    confidenceScore:
      row.confidence_score == null ? null : Number(row.confidence_score),
    isConfirmed: row.is_confirmed as boolean,
    isExcluded: row.is_excluded as boolean,
  }));

  const targets = filterActivityBlocksForReport(blocks, input.filters).filter(
    (block) => !block.projectId && !block.clientId,
  );

  if (targets.length === 0) {
    return { success: false, error: 'No unassigned sessions match this filter' };
  }

  const blockIds = targets.map((block) => block.id);
  const updateResult = await bulkUpdateActivityBlocksAction({
    accountId: input.accountId,
    accountSlug: input.accountSlug,
    blockIds,
    projectId: input.projectId,
    clientId: input.clientId,
    isConfirmed: true,
    workClassification: input.workClassification,
  });

  if (!updateResult.success) {
    return updateResult;
  }

  if (input.rememberRule && input.ruleMatch) {
    await createActivityRuleAction({
      accountId: input.accountId,
      accountSlug: input.accountSlug,
      matchType: input.ruleMatch.matchType,
      matchValue: input.ruleMatch.matchValue,
      projectId: input.projectId ?? null,
      clientId: input.clientId ?? null,
      backfill: true,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    });
  }

  return { success: true, updated: blockIds.length };
}

export async function confirmActivityBlockAction(input: {
  accountId: string;
  accountSlug: string;
  blockId: string;
}) {
  return updateActivityBlockAction({
    ...input,
    isConfirmed: true,
  });
}

function normalizeRuleMatchValue(
  matchType: CreateActivityRuleInput['matchType'],
  matchValue: string,
) {
  const trimmed = matchValue.trim();
  if (!trimmed) {
    throw new Error('Rule match value is required');
  }

  if (matchType === 'domain' || matchType === 'app_name' || matchType === 'url_path' || matchType === 'repo_name') {
    return trimmed.toLowerCase();
  }

  return trimmed;
}

function normalizeUrlForBackfill(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path =
      parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
    return `${host}${path}`;
  } catch {
    return null;
  }
}

async function backfillActivityRuleMatches(input: {
  accountId: string;
  userId: string;
  matchType: CreateActivityRuleInput['matchType'];
  matchValue: string;
  projectId: string | null;
  clientId: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  const client = getActivitySupabaseClient();

  let query = client
    .from('activity_blocks')
    .select('id, domain, app_name, url, window_title, repo_name')
    .eq('account_id', input.accountId)
    .eq('user_id', input.userId)
    .eq('is_confirmed', false)
    .eq('is_excluded', false);

  if (input.dateFrom) {
    query = query.gte('started_at', `${input.dateFrom}T00:00:00.000Z`);
  }

  if (input.dateTo) {
    query = query.lte('started_at', `${input.dateTo}T23:59:59.999Z`);
  }

  const { data, error } = await query.limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  const normalizedValue = normalizeRuleMatchValue(
    input.matchType,
    input.matchValue,
  );

  const matchingIds = (data ?? [])
    .filter((row) => {
      if (input.matchType === 'domain') {
        const domain = row.domain?.trim().toLowerCase();
        return (
          domain === normalizedValue ||
          (domain != null && domain.endsWith(`.${normalizedValue}`))
        );
      }

      if (input.matchType === 'app_name') {
        return row.app_name?.trim().toLowerCase() === normalizedValue;
      }

      if (input.matchType === 'url_path') {
        const normalizedUrl = row.url ? normalizeUrlForBackfill(row.url) : null;
        return (
          normalizedUrl === normalizedValue ||
          (normalizedUrl != null &&
            normalizedUrl.startsWith(`${normalizedValue}/`))
        );
      }

      if (input.matchType === 'repo_name') {
        return row.repo_name?.trim().toLowerCase() === normalizedValue;
      }

      const title = row.window_title ?? '';
      return title.toLowerCase().includes(normalizedValue.toLowerCase());
    })
    .map((row) => row.id as string);

  if (matchingIds.length === 0) {
    return 0;
  }

  const payload: Record<string, unknown> = { is_confirmed: true };

  if (input.projectId) {
    payload.project_id = input.projectId;
  }

  if (input.clientId) {
    payload.client_id = input.clientId;
  }

  const { error: updateError } = await client
    .from('activity_blocks')
    .update(payload)
    .in('id', matchingIds)
    .eq('account_id', input.accountId)
    .eq('user_id', input.userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return matchingIds.length;
}

export async function createActivityRuleAction(
  input: CreateActivityRuleInput,
): Promise<{ success: boolean; backfilled?: number; error?: string }> {
  const client = getActivitySupabaseClient();
  const { data: auth } = await client.auth.getUser();
  const userId = auth.user?.id;

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!input.projectId && !input.clientId) {
    return { success: false, error: 'Choose a client or project for this rule' };
  }

  if (input.projectId) {
    await assertProjectBelongsToAccount(input.projectId, input.accountId);
  }

  if (input.clientId) {
    await assertClientBelongsToAccount(input.clientId, input.accountId);
  }

  const matchValue = normalizeRuleMatchValue(input.matchType, input.matchValue);

  const { data: existingRule, error: existingError } = await client
    .from('activity_rules')
    .select('id')
    .eq('account_id', input.accountId)
    .eq('user_id', userId)
    .eq('match_type', input.matchType)
    .eq('match_value', matchValue)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  if (existingRule?.id) {
    const { error: updateError } = await client
      .from('activity_rules')
      .update({
        project_id: input.projectId ?? null,
        client_id: input.clientId ?? null,
        created_from: 'learned',
      })
      .eq('id', existingRule.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }
  } else {
    const { error: insertError } = await client.from('activity_rules').insert({
      account_id: input.accountId,
      user_id: userId,
      match_type: input.matchType,
      match_value: matchValue,
      project_id: input.projectId ?? null,
      client_id: input.clientId ?? null,
      created_from: 'learned',
    });

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  let backfilled = 0;

  if (input.backfill !== false) {
    try {
      backfilled = await backfillActivityRuleMatches({
        accountId: input.accountId,
        userId,
        matchType: input.matchType,
        matchValue: matchValue,
        projectId: input.projectId ?? null,
        clientId: input.clientId ?? null,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      });
    } catch (backfillError) {
      return {
        success: true,
        backfilled: 0,
        error:
          backfillError instanceof Error
            ? `Rule saved, but backfill failed: ${backfillError.message}`
            : 'Rule saved, but backfill failed',
      };
    }
  }

  await revalidateActivityPaths(input.accountSlug);
  return { success: true, backfilled };
}
