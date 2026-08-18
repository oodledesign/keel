'use client';

import type {
  DocListItem,
  LinkOption,
  NoteListItem,
  SavedLinkListItem,
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
  links = [],
  tableAvailable,
  docsTableAvailable = true,
  linksTableAvailable = true,
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
  links?: SavedLinkListItem[];
  tableAvailable: boolean;
  docsTableAvailable?: boolean;
  linksTableAvailable?: boolean;
  linkOptions: LinkOption[];
  defaultLink: LinkValue;
  variant?: WorkspaceNotesVariant;
  canEdit?: boolean;
  initialListFilter?: 'all' | 'pinned' | 'notes' | 'files' | 'links';
}) {
  return (
    <WorkspaceNotesPage
      accountId={accountId}
      accountSlug={accountSlug}
      notes={notes}
      docs={docs}
      links={links}
      tableAvailable={tableAvailable}
      docsTableAvailable={docsTableAvailable}
      linksTableAvailable={linksTableAvailable}
      variant={variant}
      linkOptions={linkOptions}
      defaultLink={defaultLink}
      canEdit={canEdit}
      hideFilters
      initialListFilter={initialListFilter}
    />
  );
}
