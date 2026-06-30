'use client';

import { If } from '@kit/ui/if';

import featureFlagsConfig from '~/config/feature-flags.config';

import { HomeAddAccountButton } from '../home-add-account-button';

export function DashboardWorkspaceBanner(props: {
  canCreateTeamAccount?: {
    allowed: boolean;
    reason?: string;
  };
}) {
  return (
    <If condition={featureFlagsConfig.enableTeamAccounts}>
      <div className="mx-4 mb-6 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-violet-500/10 px-4 py-4 text-violet-50 md:mx-6 lg:mx-8">
        <p className="text-sm font-medium">Organise with others (optional)</p>
        <p className="mt-1 text-sm text-violet-200/80">
          Shared spaces are for crews, family hubs, or community groups — not
          required for your personal Ozer home. Add one when you are ready from
          the button below or the Shared spaces section in the sidebar.
        </p>
        <div className="mt-3">
          <HomeAddAccountButton
            canCreateTeamAccount={props.canCreateTeamAccount}
            className="bg-violet-600 text-[var(--workspace-shell-text)] hover:bg-violet-500"
          />
        </div>
      </div>
    </If>
  );
}
