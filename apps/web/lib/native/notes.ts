import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createRecorderNote,
  listRecorderNotes,
} from '~/lib/recorder/create-note';

import { NativeHttpError } from './http';
import { toNativeNote } from './notes-shared';
import { parseOptionalClientId } from './task-map';
import type { NativeWorkspace } from './workspace';

export type { NativeNote } from './notes-shared';

export async function listNativeNotes(
  userId: string,
  workspace: NativeWorkspace,
) {
  const items = await listRecorderNotes({
    userId,
    accountId: workspace.id,
    limit: 50,
  });

  return items.map((item) =>
    toNativeNote({
      id: item.id,
      title: item.title,
      body: item.content,
      workspace: workspace.slug,
      category: item.category,
      tags: item.tags,
      clientId: item.client_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }),
  );
}

export async function createNativeNote(input: {
  userId: string;
  workspace: NativeWorkspace;
  body: string;
  title?: string | null;
  category?: string | null;
  tags?: string[] | null;
  clientId?: string | null;
  client?: SupabaseClient;
}) {
  const body = input.body.trim();
  if (!body) {
    throw new NativeHttpError(400, 'body is required');
  }

  const clientId = parseOptionalClientId(input.clientId ?? undefined) ?? null;
  if (clientId && input.client) {
    const { data, error } = await input.client
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('account_id', input.workspace.id)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new NativeHttpError(400, 'client_id must belong to this workspace');
    }
  }

  const created = await createRecorderNote({
    userId: input.userId,
    content: body,
    title: input.title,
    accountId: input.workspace.id,
    clientId,
    source: 'native',
    category: input.category,
    tags: input.tags,
  });

  return toNativeNote({
    id: created.id,
    title: created.title,
    body: created.content,
    workspace: input.workspace.slug,
    category: input.category,
    tags: input.tags,
    clientId,
    createdAt: created.created_at,
    updatedAt: created.updated_at,
  });
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
      'id, title, content, account_id, created_by, category, tags, created_at, updated_at',
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
    .select(
      'id, title, content, account_id, category, tags, created_at, updated_at',
    )
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

  return toNativeNote({
    id: data.id as string,
    title: ((data.title as string | null)?.trim() || 'Note') as string,
    body: (data.content as string | null) ?? '',
    workspace: workspaceSlug,
    category: (data.category as string | null) ?? undefined,
    tags: Array.isArray(data.tags)
      ? (data.tags as unknown[]).filter(
          (tag): tag is string =>
            typeof tag === 'string' && tag.trim().length > 0,
        )
      : [],
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  });
}
