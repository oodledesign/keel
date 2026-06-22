'use client';

import type {
  CustomNoteCategory,
  NoteListItem,
} from '../../[account]/_lib/workspace-content/types';
import { WorkspaceNotesPage } from '../../[account]/_components/workspace-content/workspace-notes-page';

import pathsConfig from '~/config/paths.config';

export function PersonalNotesPageContent({
  accountId,
  accountSlug,
  notes,
  tableAvailable,
  customCategories,
}: {
  accountId: string;
  accountSlug: string;
  notes: NoteListItem[];
  tableAvailable: boolean;
  customCategories: CustomNoteCategory[];
}) {
  return (
    <WorkspaceNotesPage
      accountId={accountId}
      accountSlug={accountSlug}
      notes={notes}
      docs={[]}
      tableAvailable={tableAvailable}
      docsTableAvailable={false}
      variant="work"
      linkOptions={[]}
      hideFilters
      newNoteHref={pathsConfig.app.personalNoteNew}
      customCategories={customCategories}
    />
  );
}
