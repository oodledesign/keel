import { PageBody } from '@kit/ui/page';

import { ClientDetailPageContent } from '../_components/client-detail-page-content';
import { ClientDetailPageNav } from '../_components/client-detail-page-nav';
import { loadClientDetailPageData } from '../_lib/server/client-detail.loader';

type Props = {
  params: Promise<{ account: string; id: string }>;
};

export default async function ClientDetailPage({ params }: Props) {
  const { account: accountSlug, id: clientId } = await params;
  const data = await loadClientDetailPageData(accountSlug, clientId);

  return (
    <PageBody className="flex min-h-0 flex-1 flex-col bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
      <ClientDetailPageNav
        accountHomeHref={data.accountHomeHref}
        clientsListHref={data.clientsListHref}
        clientDisplayName={data.clientDisplayName}
      />
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <ClientDetailPageContent
          accountSlug={data.accountSlug}
          accountId={data.accountId}
          clientId={clientId}
          canEditClients={data.canEditClients}
          isContractorView={data.isContractorView}
          clientsListHref={data.clientsListHref}
          portalHref={data.portalHref}
          workspaceNotes={data.workspaceNotes}
          workspaceDocs={data.workspaceDocs}
          notesTableAvailable={data.notesTableAvailable}
          docsTableAvailable={data.docsTableAvailable}
          linkOptions={data.linkOptions}
          defaultLink={data.defaultLink}
          notesVariant={data.notesVariant}
          ranklyEnabled={data.ranklyEnabled}
          ranklyProject={data.ranklyProject}
          ranklyImportSeed={data.ranklyImportSeed}
          ranklyClientImportOptions={data.ranklyClientImportOptions}
          initialClient={data.client}
          overviewSeed={data.overviewSeed}
        />
      </div>
    </PageBody>
  );
}
