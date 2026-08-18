'use client';

import type { NoteFolderListItem } from '../../_lib/workspace-content/note-folders.loader';
import type {
  CustomNoteCategory,
  DocListItem,
  LinkOption,
  NoteListItem,
  SavedLinkListItem,
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
  docs = [],
  links = [],
  tableAvailable,
  docsTableAvailable = false,
  linksTableAvailable = false,
  canEdit = true,
}: {
  accountSlug: string;
  notes: NoteListItem[];
  folders?: NoteFolderListItem[];
  foldersAvailable?: boolean;
  docs?: DocListItem[];
  links?: SavedLinkListItem[];
  tableAvailable: boolean;
  docsTableAvailable?: boolean;
  linksTableAvailable?: boolean;
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
      docs={docs}
      links={links}
      folders={folders}
      tableAvailable={tableAvailable}
      docsTableAvailable={docsTableAvailable}
      linksTableAvailable={linksTableAvailable}
      foldersAvailable={foldersAvailable}
      canEdit={canEdit}
      personalScope={false}
    />
  );
}
