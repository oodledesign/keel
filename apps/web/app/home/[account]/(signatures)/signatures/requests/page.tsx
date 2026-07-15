import { listSignatureChangeRequests } from '~/lib/signatures/change-requests';

import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesRequestsPanel } from '../../_components/signatures-requests-panel';
import { loadSignaturesWorkspace } from '../../_lib/server/signatures-data';

type PageProps = {
  params: Promise<{ account: string }>;
};

export default async function SignaturesRequestsPage({ params }: PageProps) {
  const { account } = await params;
  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const requests = await listSignatureChangeRequests(accountId);

  return (
    <ModuleDataSection
      title="Requests"
      description="Change requests from personal install pages — update staff details, then resolve."
    >
      <SignaturesRequestsPanel
        accountId={accountId}
        accountSlug={account}
        requests={requests}
      />
    </ModuleDataSection>
  );
}
