import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import { resolveClientListTitle } from '~/lib/clients/resolve-client-list-display';
import {
  RECORDER_NOTES_MAX_PAGE,
  type RecorderNotesClientFilter,
  sanitizeRecorderNotesSearch,
} from '~/lib/recorder/list-notes-query';
import { getPersonalAccountId } from '~/lib/recorder/personal-account';

function noteDetailPath(params: {
  noteId: string;
  isPersonal: boolean;
  slug: string | null;
}) {
  if (params.isPersonal) {
    return pathsConfig.app.personalNoteDetail.replace(
      '[noteId]',
      params.noteId,
    );
  }
  if (params.slug) {
    return workAccountPath(
      pathsConfig.app.accountNoteDetail,
      params.slug,
    ).replace('[noteId]', params.noteId);
  }
  return pathsConfig.app.personalNotes;
}

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
  client_name: string | null;
  project_id: string | null;
  category: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  detail_path: string;
};

const NOTE_CLIENT_SELECT =
  'id, display_name, first_name, last_name, company_name, client_type';

export async function createRecorderNote(params: {
  userId: string;
  content: string;
  title?: string | null;
  accountId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  createdAt?: string | null;
  source?: string | null;
  category?: string | null;
  tags?: string[] | null;
}): Promise<{
  id: string;
  detail_path: string;
  title: string;
  content: string;
  created_at: string | null;
  updated_at: string | null;
}> {
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
      .eq('account_id', accountId)
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

  const title = params.title?.trim() || firstLineTitle(content);
  const category = params.category?.trim() || 'idea';
  const tags = (params.tags ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  const { data, error } = await admin
    .from('notes')
    .insert({
      account_id: accountId,
      title,
      content,
      category,
      tags,
      is_pinned: false,
      client_id: clientId,
      project_id: projectId,
      user_id: params.userId,
      created_by: params.userId,
      ...(params.createdAt ? { created_at: params.createdAt } : {}),
    })
    .select('id, account_id, title, content, created_at, updated_at')
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
  const detailPath = noteDetailPath({
    noteId: data.id as string,
    isPersonal,
    slug,
  });

  return {
    id: data.id as string,
    detail_path: detailPath,
    title: ((data.title as string | null)?.trim() || title) as string,
    content: (data.content as string | null) ?? content,
    created_at: (data.created_at as string | null) ?? null,
    updated_at: (data.updated_at as string | null) ?? null,
  };
}

export async function listRecorderNotes(params: {
  userId: string;
  accountId?: string | null;
  limit?: number;
  offset?: number;
  clientId?: RecorderNotesClientFilter;
  category?: string | null;
  q?: string | null;
}): Promise<RecorderNoteItem[]> {
  const admin = getSupabaseServerAdminClient();
  const limit = Math.min(
    Math.max(params.limit ?? 20, 1),
    // +1 lets the route request one extra row to detect has_more.
    RECORDER_NOTES_MAX_PAGE + 1,
  );
  const offset = Math.max(params.offset ?? 0, 0);

  let accountId = params.accountId?.trim() || null;
  if (accountId) {
    await assertWorkspaceMember(admin, accountId, params.userId);
  } else {
    accountId = await getPersonalAccountId(admin, params.userId);
    if (!accountId) {
      return [];
    }
  }

  let query = admin
    .from('notes')
    .select(
      'id, title, content, account_id, client_id, project_id, category, tags, created_at, updated_at',
    )
    .eq('account_id', accountId)
    .eq('created_by', params.userId);

  if (params.clientId === 'none') {
    query = query.is('client_id', null);
  } else if (params.clientId) {
    query = query.eq('client_id', params.clientId);
  }

  if (params.category) {
    query = query.eq('category', params.category);
  }

  const safeQ = sanitizeRecorderNotesSearch(params.q);
  if (safeQ) {
    query = query.or(`title.ilike.%${safeQ}%,content.ilike.%${safeQ}%`);
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

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
  const uniqueClientIds = [
    ...new Set(
      (data ?? [])
        .map((row) => (row as { client_id?: string | null }).client_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const names = new Map<string, string>();
  if (uniqueClientIds.length > 0) {
    const { data: clients } = await admin
      .from('clients')
      .select(NOTE_CLIENT_SELECT)
      .in('id', uniqueClientIds);
    for (const row of clients ?? []) {
      const client = row as {
        id?: string;
        display_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        company_name?: string | null;
        client_type?: string | null;
      };
      const name = resolveClientListTitle(client).trim();
      if (name && client.id) {
        names.set(client.id, name);
      }
    }
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const id = row.id as string;
    const clientId = (row.client_id as string | null) ?? null;
    const detailPath = noteDetailPath({
      noteId: id,
      isPersonal,
      slug,
    });

    return {
      id,
      title: ((row.title as string | null)?.trim() || 'Note') as string,
      content: (row.content as string | null) ?? '',
      account_id: row.account_id as string,
      client_id: clientId,
      client_name: clientId ? (names.get(clientId) ?? null) : null,
      project_id: (row.project_id as string | null) ?? null,
      category: ((row.category as string | null)?.trim() || 'idea') as string,
      tags: Array.isArray(row.tags)
        ? (row.tags as unknown[]).filter(
            (tag): tag is string =>
              typeof tag === 'string' && tag.trim().length > 0,
          )
        : [],
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      detail_path: detailPath,
    };
  });
}

export async function updateRecorderNote(params: {
  userId: string;
  noteId: string;
  title?: string;
  content?: string;
  category?: string | null;
  clientId?: string | null;
}): Promise<RecorderNoteItem> {
  const admin = getSupabaseServerAdminClient();
  const { data: existing, error: loadError } = await admin
    .from('notes')
    .select(
      'id, title, content, account_id, created_by, category, tags, client_id, project_id, created_at, updated_at',
    )
    .eq('id', params.noteId)
    .maybeSingle();

  if (loadError) {
    throw new Error(loadError.message);
  }
  if (!existing || existing.created_by !== params.userId) {
    throw new Error('Note not found');
  }

  const accountId = (existing.account_id as string | null)?.trim();
  if (!accountId) {
    throw new Error('Note has no account');
  }
  await assertWorkspaceMember(admin, accountId, params.userId);

  const updates: {
    title?: string;
    content?: string;
    category?: string;
    client_id?: string | null;
  } = {};
  if (params.title !== undefined) {
    updates.title = params.title.trim() || 'Note';
  }
  if (params.content !== undefined) {
    updates.content = params.content;
    if (params.title === undefined) {
      const currentTitle = ((existing.title as string | null) ?? '').trim();
      if (!currentTitle || currentTitle === 'Note') {
        updates.title = firstLineTitle(params.content) || 'Note';
      }
    }
  }
  if (params.category !== undefined) {
    updates.category = params.category?.trim() || 'idea';
  }
  if (params.clientId !== undefined) {
    const clientId = params.clientId?.trim() || null;
    if (clientId) {
      const { data: client, error: clientError } = await admin
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('account_id', accountId)
        .maybeSingle();
      if (clientError || !client) {
        throw new Error('Client not found');
      }
    }
    updates.client_id = clientId;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('No note fields to update');
  }

  const { data, error } = await admin
    .from('notes')
    .update(updates)
    .eq('id', params.noteId)
    .eq('created_by', params.userId)
    .select(
      'id, title, content, account_id, client_id, project_id, category, tags, created_at, updated_at',
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error('Note not found');
  }

  const { data: account } = await admin
    .from('accounts')
    .select('slug, is_personal_account')
    .eq('id', accountId)
    .maybeSingle();

  const clientId = (data.client_id as string | null) ?? null;
  let clientName: string | null = null;
  if (clientId) {
    const { data: client } = await admin
      .from('clients')
      .select(NOTE_CLIENT_SELECT)
      .eq('id', clientId)
      .maybeSingle();
    if (client) {
      clientName = resolveClientListTitle(client).trim() || null;
    }
  }

  return {
    id: data.id as string,
    title: ((data.title as string | null)?.trim() || 'Note') as string,
    content: (data.content as string | null) ?? '',
    account_id: data.account_id as string,
    client_id: clientId,
    client_name: clientName,
    project_id: (data.project_id as string | null) ?? null,
    category: ((data.category as string | null)?.trim() || 'idea') as string,
    tags: Array.isArray(data.tags)
      ? (data.tags as unknown[]).filter(
          (tag): tag is string =>
            typeof tag === 'string' && tag.trim().length > 0,
        )
      : [],
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    detail_path: noteDetailPath({
      noteId: data.id as string,
      isPersonal: Boolean(account?.is_personal_account),
      slug: (account?.slug as string | null) ?? null,
    }),
  };
}
