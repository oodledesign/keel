import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { redirectIfAddonNotAllowed } from '~/lib/billing/require-addon-access';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { isCampaignsModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  ADDON_APPS_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { CampaignsModuleDisabled } from './_components/campaigns-module-disabled';

type CampaignsLayoutProps = React.PropsWithChildren<{
  params: Promise<{ account: string }>;
}>;

async function CampaignsLayout({ children, params }: CampaignsLayoutProps) {
  const { account } = await params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ADDON_APPS_SPACE_TYPES);

  await redirectIfAddonNotAllowed(
    account,
    workspace.account.id as string,
    'addon_campaigns',
  );

  if (!isCampaignsModuleEnabled(workspace.moduleSettings)) {
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={account}
          title={<Trans i18nKey="campaigns:title" />}
          description={<Trans i18nKey="campaigns:description" />}
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-8 text-[var(--workspace-shell-text)] lg:px-6">
          <CampaignsModuleDisabled accountSlug={account} />
        </PageBody>
      </>
    );
  }

  return children;
}

export default withI18n(CampaignsLayout);
