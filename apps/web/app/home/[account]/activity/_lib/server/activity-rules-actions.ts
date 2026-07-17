'use server';

import { revalidatePath } from 'next/cache';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import { getActivitySupabaseClient } from '~/lib/activity/activity-supabase';

export type ActivityRuleRow = {
  id: string;
  matchType:
    | 'domain'
    | 'app_name'
    | 'title_contains'
    | 'url_path'
    | 'repo_name';
  matchValue: string;
  projectId: string | null;
  projectName: string | null;
  clientId: string | null;
  clientName: string | null;
  createdFrom: 'manual' | 'learned';
  createdAt: string;
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
  revalidatePath(
    workAccountPath(
      pathsConfig.app.accountActivityPrivacySettings,
      accountSlug,
    ),
    'page',
  );
}

export async function listActivityRulesAction(
  accountId: string,
): Promise<{ success: boolean; rules: ActivityRuleRow[]; error?: string }> {
  const client = getActivitySupabaseClient();
  const { data: auth } = await client.auth.getUser();
  const userId = auth.user?.id;

  if (!userId) {
    return { success: false, rules: [], error: 'Not authenticated' };
  }

  const { data, error } = await client
    .from('activity_rules')
    .select(
      `
        id,
        match_type,
        match_value,
        project_id,
        client_id,
        created_from,
        created_at,
        projects:project_id ( title, name ),
        clients:client_id ( display_name )
      `,
    )
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, rules: [], error: error.message };
  }

  return {
    success: true,
    rules: (data ?? []).map((row) => ({
      id: row.id as string,
      matchType: row.match_type as ActivityRuleRow['matchType'],
      matchValue: row.match_value as string,
      projectId: (row.project_id as string | null) ?? null,
      projectName:
        (
          row.projects as { title?: string | null; name?: string | null } | null
        )?.title?.trim() ||
        (
          row.projects as { title?: string | null; name?: string | null } | null
        )?.name?.trim() ||
        null,
      clientId: (row.client_id as string | null) ?? null,
      clientName:
        (
          row.clients as { display_name?: string | null } | null
        )?.display_name?.trim() || null,
      createdFrom: row.created_from as ActivityRuleRow['createdFrom'],
      createdAt: row.created_at as string,
    })),
  };
}

export async function deleteActivityRuleAction(input: {
  accountId: string;
  accountSlug: string;
  ruleId: string;
}): Promise<{ success: boolean; error?: string }> {
  const client = getActivitySupabaseClient();
  const { data: auth } = await client.auth.getUser();
  const userId = auth.user?.id;

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  const { error } = await client
    .from('activity_rules')
    .delete()
    .eq('id', input.ruleId)
    .eq('account_id', input.accountId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  await revalidateActivityPaths(input.accountSlug);
  return { success: true };
}

export async function createManualActivityRuleAction(input: {
  accountId: string;
  accountSlug: string;
  matchType:
    | 'domain'
    | 'app_name'
    | 'title_contains'
    | 'url_path'
    | 'repo_name';
  matchValue: string;
  projectId?: string | null;
  clientId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const client = getActivitySupabaseClient();
  const { data: auth } = await client.auth.getUser();
  const userId = auth.user?.id;

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!input.projectId && !input.clientId) {
    return { success: false, error: 'Choose a client or project' };
  }

  const matchValue = input.matchValue.trim();
  if (!matchValue) {
    return { success: false, error: 'Match value is required' };
  }

  const { error } = await client.from('activity_rules').insert({
    account_id: input.accountId,
    user_id: userId,
    match_type: input.matchType,
    match_value:
      input.matchType === 'title_contains'
        ? matchValue
        : matchValue.toLowerCase(),
    project_id: input.projectId ?? null,
    client_id: input.clientId ?? null,
    created_from: 'manual',
  });

  if (error) {
    return { success: false, error: error.message };
  }

  await revalidateActivityPaths(input.accountSlug);
  return { success: true };
}
