'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { NOTE_FILE_CATEGORY_OPTIONS } from './types';

const LinkSchema = z
  .object({
    type: z.enum(['project', 'job', 'client', 'property', 'task']),
    id: z.string().uuid(),
  })
  .nullable()
  .optional();

const SaveNoteSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  noteId: z.string().uuid().optional(),
  title: z.string().max(500).optional(),
  content: z.string(),
  isPinned: z.boolean().optional(),
  category: z.enum(NOTE_FILE_CATEGORY_OPTIONS).optional(),
  tags: z.array(z.string()).optional(),
  link: LinkSchema,
});

function linkToColumns(link: z.infer<typeof LinkSchema>) {
  const cols = {
    project_id: null as string | null,
    job_id: null as string | null,
    client_id: null as string | null,
    client_org_id: null as string | null,
    property_id: null as string | null,
    task_id: null as string | null,
  };
  if (!link) return cols;
  switch (link.type) {
    case 'project':
      cols.project_id = link.id;
      break;
    case 'job':
      cols.job_id = link.id;
      break;
    case 'client':
      cols.client_id = link.id;
      cols.client_org_id = link.id;
      break;
    case 'property':
      cols.property_id = link.id;
      break;
    case 'task':
      cols.task_id = link.id;
      break;
  }
  return cols;
}

export const saveWorkspaceNoteAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const linkCols = linkToColumns(data.link);
    const tags = (data.tags ?? []).map((t) => t.trim()).filter(Boolean);

    const payload = {
      account_id: data.accountId,
      title: data.title?.trim() ?? '',
      content: data.content,
      is_pinned: data.isPinned ?? false,
      category: data.category ?? 'idea',
      tags,
      user_id: user.id,
      ...linkCols,
    };

    if (data.noteId) {
      const { error } = await client
        .from('notes')
        .update(payload)
        .eq('id', data.noteId)
        .eq('account_id', data.accountId);
      if (error) throw error;
      revalidateNotesPaths(data.accountSlug, data.noteId);
      return { noteId: data.noteId };
    }

    const { data: inserted, error } = await client
      .from('notes')
      .insert({ ...payload, created_by: user.id })
      .select('id')
      .single();

    if (error) throw error;
    const noteId = inserted.id as string;
    revalidateNotesPaths(data.accountSlug, noteId);
    return { noteId };
  },
  { schema: SaveNoteSchema },
);

export const deleteWorkspaceNoteAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('notes')
      .delete()
      .eq('id', data.noteId)
      .eq('account_id', data.accountId);
    if (error) throw error;
    revalidateNotesPaths(data.accountSlug);
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      noteId: z.string().uuid(),
    }),
  },
);

function revalidateNotesPaths(accountSlug: string, noteId?: string) {
  const base = pathsConfig.app.accountNotes.replace('[account]', accountSlug);
  revalidatePath(base);
  revalidatePath(`/home/${accountSlug}`);
  if (noteId) {
    revalidatePath(
      pathsConfig.app.accountNoteDetail
        .replace('[account]', accountSlug)
        .replace('[noteId]', noteId),
    );
  }
}
