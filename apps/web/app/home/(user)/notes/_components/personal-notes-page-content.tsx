'use client';

import type { NoteFolderListItem } from '~/home/[account]/_lib/workspace-content/note-folders.loader';
import type {
  CustomNoteCategory,
  NoteListItem,
} from '~/home/[account]/_lib/workspace-content/types';
import { NotesLibraryClient } from '~/home/[account]/notes/_components/notes-library-client';

export function PersonalNotesPageContent({
  accountId,
  accountSlug,
  notes,
  folders = [],
  foldersAvailable = true,
  tableAvailable,
}: {
  accountId: string;
  accountSlug: string;
  notes: NoteListItem[];
  folders?: NoteFolderListItem[];
  foldersAvailable?: boolean;
  tableAvailable: boolean;
  customCategories?: CustomNoteCategory[];
}) {
  return (
    <NotesLibraryClient
      accountId={accountId}
      accountSlug={accountSlug}
      notes={notes}
      folders={folders}
      tableAvailable={tableAvailable}
      foldersAvailable={foldersAvailable}
      canEdit
      personalScope
    />
  );
}
