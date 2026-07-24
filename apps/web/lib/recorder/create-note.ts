import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { getPersonalAccountId } from '~/lib/recorder/personal-account';

function firstLineTitle(content: string): string {
  const line =
    content
      .split('\n')
      .map((part) => part.trim())
      .find(Boolean) ?? 'Note';
  return line.slice(0, 120);
}

export type RecorderNoteItem = {
  id: string;
  title: string;
  content: string;
  account_id: string;
  client_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  detail_path: string;
};

export async function createRecorderNote(params: {
  userId: string;
  content: string;
  accountId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  createdAt?: string | null;
  source?: string | null;
}): Promise<{ id: string; detail_path: string }> {
  const content = params.content.trim();
  if (!content) {
    throw new Error('Note content is required');
  }

  const admin = getSupabaseServerAdminClient();
  let accountId = params.accountId?.trim() || null;

  if (accountId) {
    await assertWorkspaceMember(admin, accountId, params.userId);
  } else {
    accountId = await getPersonalAccountId(admin, params.userId);
    if (!accountId) {
      throw new Error('Personal workspace not found');
    }
  }

  const clientId = params.clientId?.trim() || null;
  const projectId = params.projectId?.trim() || null;

  if (clientId) {
    const { data: client, error: clientError } = await admin
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .maybeSingle();
    if (clientError || !client) {
      throw new Error('Client not found');
    }
  }

  if (projectId) {
    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .maybeSingle();
    if (projectError || !project) {
      throw new Error('Project not found');
    }
  }

  const title = firstLineTitle(content);
  const { data, error } = await admin
    .from('notes')
    .insert({
      account_id: accountId,
      title,
      content,
      category: 'idea',
      tags: [],
      is_pinned: false,
      client_id: clientId,
      project_id: projectId,
      user_id: params.userId,
      created_by: params.userId,
      ...(params.createdAt ? { created_at: params.createdAt } : {}),
    })
    .select('id, account_id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Failed to create note');
  }

  const { data: account } = await admin
    .from('accounts')
    .select('slug, is_personal_account')
    .eq('id', data.account_id as string)
    .maybeSingle();

  const isPersonal = Boolean(account?.is_personal_account);
  const slug = (account?.slug as string | null) ?? null;
  const detailPath = isPersonal
    ? pathsConfig.app.personalNoteDetail.replace('[noteId]', data.id as string)
    : slug
      ? workAccountPath(
          pathsConfig.app.accountNoteDetail,
          slug,
        ).replace('[noteId]', data.id as string)
      : pathsConfig.app.personalNotes;

  return {
    id: data.id as string,
    detail_path: detailPath,
  };
}

export async function listRecorderNotes(params: {
  userId: string;
  accountId?: string | null;
  limit?: number;
}): Promise<RecorderNoteItem[]> {
  const admin = getSupabaseServerAdminClient();
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);

  let accountId = params.accountId?.trim() || null;
  if (accountId) {
    await assertWorkspaceMember(admin, accountId, params.userId);
  } else {
    accountId = await getPersonalAccountId(admin, params.userId);
    if (!accountId) {
      return [];
    }
  }

  const { data, error } = await admin
    .from('notes')
    .select('id, title, content, account_id, client_id, project_id, created_at, updated_at')
    .eq('account_id', accountId)
    .eq('created_by', params.userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const { data: account } = await admin
    .from('accounts')
    .select('slug, is_personal_account')
    .eq('id', accountId)
    .maybeSingle();

  const isPersonal = Boolean(account?.is_personal_account);
  const slug = (account?.slug as string | null) ?? null;

  return (data ?? []).map((row) => {
    const id = row.id as string;
    const detailPath = isPersonal
      ? pathsConfig.app.personalNoteDetail.replace('[noteId]', id)
      : slug
        ? workAccountPath(
            pathsConfig.app.accountNoteDetail,
            slug,
          ).replace('[noteId]', id)
        : pathsConfig.app.personalNotes;

    return {
      id,
      title: ((row.title as string | null)?.trim() || 'Note') as string,
      content: (row.content as string | null) ?? '',
      account_id: row.account_id as string,
      client_id: (row.client_id as string | null) ?? null,
      project_id: (row.project_id as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      detail_path: detailPath,
    };
  });
}
