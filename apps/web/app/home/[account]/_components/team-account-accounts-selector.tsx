'use client';

import featureFlagsConfig from '~/config/feature-flags.config';
import {
  WorkspaceAccountsSelector,
  buildPersonalSwitcherAccounts,
} from '~/components/workspace-shell/workspace-accounts-selector';
import type { WorkspaceSwitcherAccount } from '~/home/_lib/server/workspace-switcher.loader';

export function TeamAccountAccountsSelector(params: {
  selectedAccount: string;
  userId: string;
  className?: string;
  accounts: WorkspaceSwitcherAccount[];
}) {
  return (
    <WorkspaceAccountsSelector
      selectedAccount={params.selectedAccount}
      userId={params.userId}
      accounts={buildPersonalSwitcherAccounts(params.accounts)}
      className={params.className}
      enableTeamCreation={featureFlagsConfig.enableTeamCreation}
    />
  );
}
