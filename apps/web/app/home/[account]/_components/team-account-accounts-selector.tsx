import {
  WorkspaceAccountsSelector,
  type WorkspaceSwitcherPortal,
  buildPersonalSwitcherAccounts,
} from '~/components/workspace-shell/workspace-accounts-selector';
import featureFlagsConfig from '~/config/feature-flags.config';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';

export function TeamAccountAccountsSelector(params: {
  selectedAccount: string;
  userId: string;
  className?: string;
  accounts: WorkspaceSwitcherAccount[];
  portals?: WorkspaceSwitcherPortal[];
}) {
  return (
    <WorkspaceAccountsSelector
      selectedAccount={params.selectedAccount}
      userId={params.userId}
      accounts={buildPersonalSwitcherAccounts(params.accounts)}
      portals={params.portals}
      className={params.className}
      enableTeamCreation={featureFlagsConfig.enableTeamCreation}
    />
  );
}
