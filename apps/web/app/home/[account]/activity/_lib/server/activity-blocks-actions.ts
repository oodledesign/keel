'use server';

import { revalidatePath } from 'next/cache';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import { getActivitySupabaseClient } from '~/lib/activity/activity-supabase';

type UpdateActivityBlockInput = {
  accountId: string;
  accountSlug: string;
  blockId: string;
  projectId?: string | null;
  clientId?: string | null;
  isConfirmed?: boolean;
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
};

type BulkExcludeActivityBlocksInput = {
  accountId: string;
  accountSlug: string;
  blockIds: string[];
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
