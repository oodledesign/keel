'use client';

import type { LinkOption, NoteListItem, WorkspaceNotesVariant } from '../../_lib/workspace-content/types';
import { WorkspaceNotesPage } from '../../_components/workspace-content/workspace-notes-page';

export type { NoteListItem as WorkNoteListItem };

export function NotesPageContent({
  accountId,
  accountSlug,
  notes,
  tableAvailable,
  variant,
  linkOptions,
}: {
  accountSlug: string;
  notes: NoteListItem[];
  tableAvailable: boolean;
  variant: WorkspaceNotesVariant;
  accountId: string;
  linkOptions: LinkOption[];
}) {
  return (
    <WorkspaceNotesPage
      accountId={accountId}
      accountSlug={accountSlug}
      notes={notes}
      tableAvailable={tableAvailable}
      variant={variant}
      linkOptions={linkOptions}
    />
  );
}
