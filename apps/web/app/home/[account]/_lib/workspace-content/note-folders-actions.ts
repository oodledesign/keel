'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { workAccountPath } from '../work-account-path';

function revalidateNotesSurfaces(accountSlug: string, personalScope?: boolean) {
  if (personalScope) {
    revalidatePath(pathsConfig.app.personalNotes);
    revalidatePath(pathsConfig.app.home);
    return;
  }

  revalidatePath(
    pathsConfig.app.accountNotes.replace('[account]', accountSlug),
  );
  revalidatePath(workAccountPath(pathsConfig.app.accountHome, accountSlug));
}

const CreateFolderSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  parentFolderId: z.string().uuid().nullable().optional(),
  personalScope: z.boolean().optional(),
});

export const createNoteFolderAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { data: inserted, error } = await client
      .from('note_folders')
      .insert({
        account_id: data.accountId,
        name: data.name.trim(),
        parent_folder_id: data.parentFolderId ?? null,
      })
      .select('id, name, parent_folder_id, sort_order, created_at')
      .single();

    if (error) throw error;

    revalidateNotesSurfaces(data.accountSlug, data.personalScope);

    return {
      id: inserted.id as string,
      name: inserted.name as string,
      parentFolderId: (inserted.parent_folder_id as string | null) ?? null,
      sortOrder: (inserted.sort_order as number | null) ?? 0,
      createdAt: inserted.created_at as string,
    };
  },
  { schema: CreateFolderSchema },
);

const RenameFolderSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  folderId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  personalScope: z.boolean().optional(),
});

export const renameNoteFolderAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('note_folders')
      .update({ name: data.name.trim(), updated_at: new Date().toISOString() })
      .eq('id', data.folderId)
      .eq('account_id', data.accountId);

    if (error) throw error;
    revalidateNotesSurfaces(data.accountSlug, data.personalScope);
    return { ok: true as const };
  },
  { schema: RenameFolderSchema },
);

const DeleteFolderSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  folderId: z.string().uuid(),
  personalScope: z.boolean().optional(),
});

export const deleteNoteFolderAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();

    // Notes in this folder become unfiled (ON DELETE SET NULL also covers this).
    const { error } = await client
      .from('note_folders')
      .delete()
      .eq('id', data.folderId)
      .eq('account_id', data.accountId);

    if (error) throw error;
    revalidateNotesSurfaces(data.accountSlug, data.personalScope);
    return { ok: true as const };
  },
  { schema: DeleteFolderSchema },
);

const MoveNoteSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  noteId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
  personalScope: z.boolean().optional(),
});

export const moveNoteToFolderAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('notes')
      .update({ folder_id: data.folderId })
      .eq('id', data.noteId)
      .eq('account_id', data.accountId);

    if (error) throw error;
    revalidateNotesSurfaces(data.accountSlug, data.personalScope);
    return { ok: true as const };
  },
  { schema: MoveNoteSchema },
);

const DuplicateNoteSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  noteId: z.string().uuid(),
  personalScope: z.boolean().optional(),
});

export const duplicateNoteAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const { data: source, error: loadError } = await client
      .from('notes')
      .select(
        'title, content, is_pinned, category, tags, folder_id, project_id, client_id, client_org_id, property_id, task_id',
      )
      .eq('id', data.noteId)
      .eq('account_id', data.accountId)
      .maybeSingle();

    if (loadError) throw loadError;
    if (!source) throw new Error('Note not found');

    const title = ((source.title as string) ?? '').trim();
    const { data: inserted, error } = await client
      .from('notes')
      .insert({
        account_id: data.accountId,
        title: title ? `${title} (copy)` : 'Untitled (copy)',
        content: (source.content as string) ?? '',
        is_pinned: false,
        category: (source.category as string) ?? 'idea',
        tags: (source.tags as string[] | null) ?? [],
        folder_id: (source.folder_id as string | null) ?? null,
        project_id: (source.project_id as string | null) ?? null,
        client_id: (source.client_id as string | null) ?? null,
        client_org_id: (source.client_org_id as string | null) ?? null,
        property_id: (source.property_id as string | null) ?? null,
        task_id: (source.task_id as string | null) ?? null,
        user_id: user.id,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) throw error;

    revalidateNotesSurfaces(data.accountSlug, data.personalScope);
    return { noteId: inserted.id as string };
  },
  { schema: DuplicateNoteSchema },
);
