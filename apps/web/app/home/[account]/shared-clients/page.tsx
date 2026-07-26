import { PageBody } from '@kit/ui/page';

import { listActiveSharesForGuest } from '~/lib/clients/client-workspace-shares.service';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { SharedClientsList } from './_components/shared-clients-list';

export const generateMetadata = async () => ({ title: 'Shared clients' });

async function SharedClientsPage({
  params,
}: {
  params: Promise<{ account: string }>;
}) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const shares = await listActiveSharesForGuest(workspace.account.id);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title="Shared clients"
        description="Clients shared with this workspace by partner agencies"
        account={accountSlug}
      />
      <PageBody>
        <SharedClientsList accountSlug={accountSlug} shares={shares} />
      </PageBody>
    </>
  );
}

export default withI18n(SharedClientsPage);
