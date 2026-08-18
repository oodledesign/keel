'use client';

import type { NoteFolderListItem } from '~/home/[account]/_lib/workspace-content/note-folders.loader';
import type {
  CustomNoteCategory,
  NoteListItem,
  SavedLinkListItem,
} from '~/home/[account]/_lib/workspace-content/types';
import { NotesLibraryClient } from '~/home/[account]/notes/_components/notes-library-client';

export function PersonalNotesPageContent({
  accountId,
  accountSlug,
  notes,
  links = [],
  folders = [],
  foldersAvailable = true,
  tableAvailable,
  linksTableAvailable = false,
}: {
  accountId: string;
  accountSlug: string;
  notes: NoteListItem[];
  links?: SavedLinkListItem[];
  folders?: NoteFolderListItem[];
  foldersAvailable?: boolean;
  tableAvailable: boolean;
  linksTableAvailable?: boolean;
  customCategories?: CustomNoteCategory[];
}) {
  return (
    <NotesLibraryClient
      accountId={accountId}
      accountSlug={accountSlug}
      notes={notes}
      links={links}
      folders={folders}
      tableAvailable={tableAvailable}
      foldersAvailable={foldersAvailable}
      linksTableAvailable={linksTableAvailable}
      canEdit
      personalScope
    />
  );
}
