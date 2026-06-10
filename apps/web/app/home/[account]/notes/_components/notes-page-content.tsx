'use client';

import type {
  DocListItem,
  LinkOption,
  NoteListItem,
  WorkspaceNotesVariant,
} from '../../_lib/workspace-content/types';
import { WorkspaceNotesPage } from '../../_components/workspace-content/workspace-notes-page';

export type { NoteListItem as WorkNoteListItem };

export function NotesPageContent({
  accountId,
  accountSlug,
  notes,
  docs = [],
  tableAvailable,
  docsTableAvailable = true,
  variant,
  linkOptions,
}: {
  accountSlug: string;
  notes: NoteListItem[];
  docs?: DocListItem[];
  tableAvailable: boolean;
  docsTableAvailable?: boolean;
  variant: WorkspaceNotesVariant;
  accountId: string;
  linkOptions: LinkOption[];
}) {
  return (
    <WorkspaceNotesPage
      accountId={accountId}
      accountSlug={accountSlug}
      notes={notes}
      docs={docs}
      tableAvailable={tableAvailable}
      docsTableAvailable={docsTableAvailable}
      variant={variant}
      linkOptions={linkOptions}
    />
  );
}
