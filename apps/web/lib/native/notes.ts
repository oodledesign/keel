import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createRecorderNote,
  listRecorderNotes,
} from '~/lib/recorder/create-note';

import { NativeHttpError } from './http';
import type { NativeWorkspace } from './workspace';

export type NativeNote = {
  id: string;
  title: string;
  body: string;
  workspace: string;
  created_at: string;
  updated_at: string;
};

export async function listNativeNotes(
  userId: string,
  workspace: NativeWorkspace,
) {
  const items = await listRecorderNotes({
    userId,
    accountId: workspace.id,
    limit: 50,
  });

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.content,
    workspace: workspace.slug,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

export async function createNativeNote(input: {
  userId: string;
  workspace: NativeWorkspace;
  body: string;
  title?: string | null;
}) {
  const body = input.body.trim();
  if (!body) {
    throw new NativeHttpError(400, 'body is required');
  }

  const created = await createRecorderNote({
    userId: input.userId,
    content: body,
    title: input.title,
    accountId: input.workspace.id,
    source: 'native',
  });

  return {
    id: created.id,
    title: created.title,
    body: created.content,
    workspace: input.workspace.slug,
    created_at: created.created_at ?? new Date().toISOString(),
    updated_at: created.updated_at ?? new Date().toISOString(),
  };
}

export async function updateNativeNote(input: {
  client: SupabaseClient;
  userId: string;
  noteId: string;
  title?: string;
  body?: string;
}) {
  const { data: existing, error: loadError } = await input.client
    .from('notes')
    .select(
      'id, title, content, account_id, created_by, created_at, updated_at',
    )
    .eq('id', input.noteId)
    .maybeSingle();

  if (loadError) {
    throw new Error(loadError.message);
  }

  if (!existing || existing.created_by !== input.userId) {
    throw new NativeHttpError(404, 'Note not found');
  }

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) {
      throw new NativeHttpError(400, 'title is required');
    }
    updates.title = title;
  }
  if (input.body !== undefined) {
    const body = input.body.trim();
    if (!body) {
      throw new NativeHttpError(400, 'body is required');
    }
    updates.content = body;
  }

  if (Object.keys(updates).length === 0) {
    throw new NativeHttpError(400, 'No note fields to update');
  }

  const { data, error } = await input.client
    .from('notes')
    .update(updates)
    .eq('id', input.noteId)
    .eq('created_by', input.userId)
    .select('id, title, content, account_id, created_at, updated_at')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NativeHttpError(404, 'Note not found');
  }

  let workspaceSlug = '';
  if (data.account_id) {
    const { data: account } = await input.client
      .from('accounts')
      .select('slug')
      .eq('id', data.account_id as string)
      .maybeSingle();
    workspaceSlug = account?.slug?.trim() || '';
  }

  return {
    id: data.id as string,
    title: ((data.title as string | null)?.trim() || 'Note') as string,
    body: (data.content as string | null) ?? '',
    workspace: workspaceSlug,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}
