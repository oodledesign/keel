'use client';

import { useRouter } from 'next/navigation';

import type { LinkOption, NoteListItem, WorkspaceNotesVariant } from '../../_lib/workspace-content/types';
import type { LinkValue } from '../../_components/workspace-content/link-to-select';
import type { DocListItem } from '../../_lib/workspace-content/types';
import type {
  RanklyClientImportOption,
  RanklyProjectRow,
} from '../../_lib/server/rankly-account-data';
import type { ClientDetailOverviewSeed } from '../_lib/client-detail.types';
import { ClientDetailSidebar } from './client-detail-sidebar';

type ClientSeed = {
  id: string;
  account_id: string;
  client_type?: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  picture_url: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  accountSlug: string;
  accountId: string;
  clientId: string;
  canEditClients: boolean;
  isContractorView: boolean;
  clientsListHref: string;
  portalHref: string | null;
  workspaceNotes: NoteListItem[];
  workspaceDocs: DocListItem[];
  notesTableAvailable: boolean;
  docsTableAvailable: boolean;
  linkOptions: LinkOption[];
  defaultLink: LinkValue;
  notesVariant: WorkspaceNotesVariant;
  ranklyEnabled?: boolean;
  ranklyProject?: RanklyProjectRow | null;
  ranklyImportSeed?: RanklyClientImportOption | null;
  ranklyClientImportOptions?: RanklyClientImportOption[];
  initialClient?: ClientSeed | null;
  overviewSeed?: ClientDetailOverviewSeed;
};

export function ClientDetailPageContent({
  accountSlug,
  accountId,
  clientId,
  canEditClients,
  isContractorView,
  clientsListHref,
  portalHref,
  workspaceNotes,
  workspaceDocs,
  notesTableAvailable,
  docsTableAvailable,
  linkOptions,
  defaultLink,
  notesVariant,
  ranklyEnabled = false,
  ranklyProject = null,
  ranklyImportSeed = null,
  ranklyClientImportOptions = [],
  initialClient = null,
  overviewSeed,
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
      portalHref={portalHref}
      fullPage
      workspaceNotes={workspaceNotes}
      workspaceDocs={workspaceDocs}
      notesTableAvailable={notesTableAvailable}
      docsTableAvailable={docsTableAvailable}
      linkOptions={linkOptions}
      defaultLink={defaultLink}
      notesVariant={notesVariant}
      ranklyEnabled={ranklyEnabled}
      ranklyProject={ranklyProject}
      ranklyImportSeed={ranklyImportSeed}
      ranklyClientImportOptions={ranklyClientImportOptions}
      initialClient={initialClient}
      overviewSeed={overviewSeed}
    />
  );
}
