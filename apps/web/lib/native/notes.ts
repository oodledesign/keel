import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createRecorderNote,
  listRecorderNotes,
} from '~/lib/recorder/create-note';

import { NativeHttpError } from './http';
import {
  NATIVE_NOTE_CATEGORY_SLUG_RE,
  isNativeSystemNoteCategory,
  mergeNativeNoteCategories,
  type NativeNoteCategory,
  toNativeNote,
} from './notes-shared';
import { parseOptionalClientId } from './task-map';
import type { NativeWorkspace } from './workspace-shared';

export type { NativeNote, NativeNoteCategory } from './notes-shared';

function isTableMissing(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find') ||
    error.code === 'PGRST205' ||
    error.code === '42P01'
  );
}

async function requireClientInWorkspace(
  client: SupabaseClient,
  clientId: string,
  accountId: string,
) {
  const { data, error } = await client
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new NativeHttpError(400, 'client_id must belong to this workspace');
  }
}

async function loadCustomNoteCategories(
  client: SupabaseClient,
  accountId: string,
): Promise<Array<{ slug: string; label: string }>> {
  const { data, error } = await client
    .from('note_categories')
    .select('slug, label')
    .eq('account_id', accountId)
    .order('label', { ascending: true });

  if (error) {
    if (isTableMissing(error)) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => ({
      slug: typeof row.slug === 'string' ? row.slug.trim() : '',
      label: typeof row.label === 'string' ? row.label.trim() : '',
    }))
    .filter((row) => row.slug.length > 0);
}

async function assertNativeNoteCategory(
  client: SupabaseClient,
  accountId: string,
  slug: string,
) {
  if (isNativeSystemNoteCategory(slug)) {
    return;
  }

  const custom = await loadCustomNoteCategories(client, accountId);
  if (!custom.some((row) => row.slug === slug)) {
    throw new NativeHttpError(400, 'Unknown note category');
  }
}

function parseNoteCategory(value: string | null | undefined) {
  if (value == null) {
    return undefined;
  }

  const slug = value.trim();
  if (!slug) {
    return undefined;
  }

  if (!NATIVE_NOTE_CATEGORY_SLUG_RE.test(slug)) {
    throw new NativeHttpError(400, 'Invalid note category');
  }

  return slug;
}

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

export async function listNativeNoteCategories(
  client: SupabaseClient,
  workspace: NativeWorkspace,
): Promise<NativeNoteCategory[]> {
  const custom = await loadCustomNoteCategories(client, workspace.id);
  return mergeNativeNoteCategories(custom);
}

export async function createNativeNote(input: {
  userId: string;
  workspace: NativeWorkspace;
  body: string;
  title?: string | null;
  category?: string | null;
  tags?: string[] | null;
  clientId?: string | null;
  client: SupabaseClient;
}) {
  const body = input.body.trim();
  if (!body) {
    throw new NativeHttpError(400, 'body is required');
  }

  const clientId = parseOptionalClientId(input.clientId ?? undefined) ?? null;
  if (clientId) {
    await requireClientInWorkspace(
      input.client,
      clientId,
      input.workspace.id,
    );
  }

  const category = parseNoteCategory(input.category);
  if (category) {
    await assertNativeNoteCategory(
      input.client,
      input.workspace.id,
      category,
    );
  }

  const created = await createRecorderNote({
    userId: input.userId,
    content: body,
    title: input.title,
    accountId: input.workspace.id,
    clientId,
    source: 'native',
    category,
    tags: input.tags,
  });

  return toNativeNote({
    id: created.id,
    title: created.title,
    body: created.content,
    workspace: input.workspace.slug,
    category,
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
  category?: string;
  clientId?: string | null;
}) {
  const { data: existing, error: loadError } = await input.client
    .from('notes')
    .select(
      'id, title, content, account_id, created_by, category, tags, client_id, created_at, updated_at',
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
  if (input.category !== undefined) {
    const category = parseNoteCategory(input.category);
    if (!category) {
      throw new NativeHttpError(400, 'category is required');
    }
    await assertNativeNoteCategory(
      input.client,
      existing.account_id as string,
      category,
    );
    updates.category = category;
  }
  if (input.clientId !== undefined) {
    const clientId = parseOptionalClientId(input.clientId) ?? null;
    if (clientId) {
      await requireClientInWorkspace(
        input.client,
        clientId,
        existing.account_id as string,
      );
    }
    updates.client_id = clientId;
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
      'id, title, content, account_id, category, tags, client_id, created_at, updated_at',
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
    clientId: (data.client_id as string | null) ?? null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  });
}
