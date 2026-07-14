'use client';

import type { NoteFolderListItem } from '../../_lib/workspace-content/note-folders.loader';
import type {
  CustomNoteCategory,
  DocListItem,
  LinkOption,
  NoteListItem,
  WorkspaceNotesVariant,
} from '../../_lib/workspace-content/types';
import { NotesLibraryClient } from './notes-library-client';

export type { NoteListItem as WorkNoteListItem };

export function NotesPageContent({
  accountId,
  accountSlug,
  notes,
  folders = [],
  foldersAvailable = true,
  tableAvailable,
  canEdit = true,
}: {
  accountSlug: string;
  notes: NoteListItem[];
  folders?: NoteFolderListItem[];
  foldersAvailable?: boolean;
  docs?: DocListItem[];
  tableAvailable: boolean;
  docsTableAvailable?: boolean;
  variant?: WorkspaceNotesVariant;
  accountId: string;
  linkOptions?: LinkOption[];
  customCategories?: CustomNoteCategory[];
  canEdit?: boolean;
}) {
  return (
    <NotesLibraryClient
      accountId={accountId}
      accountSlug={accountSlug}
      notes={notes}
      folders={folders}
      tableAvailable={tableAvailable}
      foldersAvailable={foldersAvailable}
      canEdit={canEdit}
      personalScope={false}
    />
  );
}
