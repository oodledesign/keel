'use client';

import { useRouter } from 'next/navigation';

import type { LinkOption, NoteListItem, WorkspaceNotesVariant } from '../../_lib/workspace-content/types';
import type { LinkValue } from '../../_components/workspace-content/link-to-select';
import type { DocListItem } from '../../_lib/workspace-content/types';
import { ClientDetailSidebar } from './client-detail-sidebar';

type Props = {
  accountSlug: string;
  accountId: string;
  clientId: string;
  canEditClients: boolean;
  isContractorView: boolean;
  clientsListHref: string;
  workspaceNotes: NoteListItem[];
  workspaceDocs: DocListItem[];
  notesTableAvailable: boolean;
  docsTableAvailable: boolean;
  linkOptions: LinkOption[];
  defaultLink: LinkValue;
  notesVariant: WorkspaceNotesVariant;
};

export function ClientDetailPageContent({
  accountSlug,
  accountId,
  clientId,
  canEditClients,
  isContractorView,
  clientsListHref,
  workspaceNotes,
  workspaceDocs,
  notesTableAvailable,
  docsTableAvailable,
  linkOptions,
  defaultLink,
  notesVariant,
}: Props) {
  const router = useRouter();

  const goToList = () => router.push(clientsListHref);

  return (
    <ClientDetailSidebar
      accountSlug={accountSlug}
      accountId={accountId}
      clientId={clientId}
      canEditClients={canEditClients}
      isContractorView={isContractorView}
      onClose={goToList}
      onSaved={goToList}
      onDeleted={goToList}
      fullPage
      workspaceNotes={workspaceNotes}
      workspaceDocs={workspaceDocs}
      notesTableAvailable={notesTableAvailable}
      docsTableAvailable={docsTableAvailable}
      linkOptions={linkOptions}
      defaultLink={defaultLink}
      notesVariant={notesVariant}
    />
  );
}
