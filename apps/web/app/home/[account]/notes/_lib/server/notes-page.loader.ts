import 'server-only';

import { redirect } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import {
  linkOptionsForProfile,
  loadWorkspaceLinkOptions,
} from '../../../_lib/workspace-content/link-options.loader';
import { loadAccountDocs } from '../../../_lib/workspace-content/docs-loader';
import { loadAccountNotes } from '../../../_lib/workspace-content/notes-loader';
import type { NoteListItem } from '../../../_lib/workspace-content/types';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  notesVariantFromProfile,
  resolveWorkspaceProfile,
} from '../../../_lib/server/workspace-profile';
import {
  ACCOUNT_NOTES_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';
import { loadAccountNoteById } from '../../../_lib/workspace-content/notes-loader';

export type WorkNoteListItem = NoteListItem;

export async function loadNotesPageData(accountSlug: string) {
  const workspace = await loadTeamWorkspace(accountSlug);

  if (!workspace?.account) {
    redirect(pathsConfig.app.home);
  }

  redirectIfSpaceNotIn(workspace, accountSlug, ACCOUNT_NOTES_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const profile = resolveWorkspaceProfile({
    space_type: (workspace.account as { space_type?: string }).space_type,
    business_type: workspace.businessType,
  });

  const [{ notes, tableAvailable }, docsResult, linkOpts] = await Promise.all([
    loadAccountNotes(accountId),
    loadAccountDocs(accountId),
    loadWorkspaceLinkOptions(accountId, profile),
  ]);

  return {
    accountId,
    accountSlug: workspace.account.slug ?? accountSlug,
    notes,
    docs: docsResult.docs,
    tableAvailable,
    docsTableAvailable: docsResult.tableAvailable,
    variant: notesVariantFromProfile(profile),
    linkOptions: linkOptionsForProfile(linkOpts, profile),
  };
}

export async function loadNoteDetailData(
  accountSlug: string,
  noteId: string,
) {
  const workspace = await loadTeamWorkspace(accountSlug);

  if (!workspace?.account) {
    redirect(pathsConfig.app.home);
  }

  redirectIfSpaceNotIn(workspace, accountSlug, ACCOUNT_NOTES_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const note = await loadAccountNoteById(accountId, noteId);

  if (!note) {
    redirect(
      pathsConfig.app.accountNotes.replace('[account]', accountSlug),
    );
  }

  return {
    accountId,
    accountSlug: workspace.account.slug ?? accountSlug,
    note: {
      id: note.id,
      title: note.title,
      content: note.content,
      isPinned: note.isPinned,
      jobId: note.jobId,
      clientId: note.clientId ?? note.clientOrgId,
      propertyId: note.propertyId,
      projectName:
        note.context?.type === 'job' || note.context?.type === 'project'
          ? note.context.label
          : null,
      clientName:
        note.context?.type === 'client' ? note.context.label : null,
      propertyName:
        note.context?.type === 'property' ? note.context.label : null,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    },
  };
}
