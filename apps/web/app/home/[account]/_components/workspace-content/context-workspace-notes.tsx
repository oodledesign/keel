'use client';

import type {
  LinkOption,
  NoteListItem,
  WorkspaceNotesVariant,
} from '../../_lib/workspace-content/types';
import type { LinkValue } from './link-to-select';
import { WorkspaceNotesPage } from './workspace-notes-page';

/** Notes scoped to a project, client, property, or job detail page. */
export function ContextWorkspaceNotes({
  accountId,
  accountSlug,
  notes,
  tableAvailable,
  linkOptions,
  defaultLink,
  variant = 'work',
  canEdit = true,
}: {
  accountId: string;
  accountSlug: string;
  notes: NoteListItem[];
  tableAvailable: boolean;
  linkOptions: LinkOption[];
  defaultLink: LinkValue;
  variant?: WorkspaceNotesVariant;
  canEdit?: boolean;
}) {
  return (
    <WorkspaceNotesPage
      accountId={accountId}
      accountSlug={accountSlug}
      notes={notes}
      tableAvailable={tableAvailable}
      variant={variant}
      linkOptions={linkOptions}
      defaultLink={defaultLink}
      canEdit={canEdit}
      hideFilters
    />
  );
}
