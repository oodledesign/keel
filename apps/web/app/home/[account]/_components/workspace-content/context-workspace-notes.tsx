'use client';

import type {
  DocListItem,
  LinkOption,
  NoteListItem,
  WorkspaceNotesVariant,
} from '../../_lib/workspace-content/types';
import type { LinkValue } from './link-to-select';
import { WorkspaceNotesPage } from './workspace-notes-page';

/** Notes and files scoped to a project, client, property, or job detail page. */
export function ContextWorkspaceNotes({
  accountId,
  accountSlug,
  notes,
  docs = [],
  tableAvailable,
  docsTableAvailable = true,
  linkOptions,
  defaultLink,
  variant = 'work',
  canEdit = true,
  initialListFilter = 'all',
}: {
  accountId: string;
  accountSlug: string;
  notes: NoteListItem[];
  docs?: DocListItem[];
  tableAvailable: boolean;
  docsTableAvailable?: boolean;
  linkOptions: LinkOption[];
  defaultLink: LinkValue;
  variant?: WorkspaceNotesVariant;
  canEdit?: boolean;
  initialListFilter?: 'all' | 'pinned' | 'notes' | 'files';
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
      defaultLink={defaultLink}
      canEdit={canEdit}
      hideFilters
      initialListFilter={initialListFilter}
    />
  );
}
