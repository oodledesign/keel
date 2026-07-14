import 'server-only';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { getPersonalAccountId } from '~/lib/recorder/personal-account';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { loadAccountNoteCategories } from '~/home/[account]/_lib/workspace-content/note-categories.loader';
import { loadAccountNoteFolders } from '~/home/[account]/_lib/workspace-content/note-folders.loader';
import {
  loadAccountNoteById,
  loadAccountNotes,
} from '~/home/[account]/_lib/workspace-content/notes-loader';

export const PERSONAL_NOTES_ACCOUNT_SLUG = 'personal';

export async function requirePersonalAccountId() {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const accountId = await getPersonalAccountId(client, user.id);

  if (!accountId) {
    redirect(pathsConfig.app.home);
  }

  return { accountId, userId: user.id };
}

export async function loadPersonalNotesPageData() {
  const { accountId } = await requirePersonalAccountId();

  const [{ notes, tableAvailable }, categoryResult, foldersResult] =
    await Promise.all([
      loadAccountNotes(accountId),
      loadAccountNoteCategories(accountId),
      loadAccountNoteFolders(accountId),
    ]);

  return {
    accountId,
    accountSlug: PERSONAL_NOTES_ACCOUNT_SLUG,
    notes,
    folders: foldersResult.folders,
    foldersAvailable: foldersResult.tableAvailable,
    tableAvailable,
    customCategories: categoryResult.categories.map((c) => ({
      slug: c.slug,
      label: c.label,
    })),
  };
}

export async function loadPersonalNoteDetailData(noteId: string) {
  const { accountId } = await requirePersonalAccountId();

  const note = await loadAccountNoteById(accountId, noteId);

  if (!note) {
    redirect(pathsConfig.app.personalNotes);
  }

  const { categories: customCategories } =
    await loadAccountNoteCategories(accountId);

  return {
    accountId,
    accountSlug: PERSONAL_NOTES_ACCOUNT_SLUG,
    note: {
      id: note.id,
      title: note.title,
      content: note.content,
      isPinned: note.isPinned,
      category: note.category,
      tags: note.tags,
      isPublic: note.isPublic,
      jobId: note.jobId,
      clientId: note.clientId ?? note.clientOrgId,
      propertyId: note.propertyId,
      projectName: null,
      clientName: null,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    },
    customCategories: customCategories.map((c) => ({
      slug: c.slug,
      label: c.label,
    })),
  };
}
