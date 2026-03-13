import { use } from 'react';

import Link from 'next/link';

import {
  CardButton,
  CardButtonHeader,
  CardButtonTitle,
} from '@kit/ui/card-button';
import {
  EmptyState,
  EmptyStateButton,
  EmptyStateHeading,
  EmptyStateText,
} from '@kit/ui/empty-state';
import { Trans } from '@kit/ui/trans';

import { loadUserWorkspace } from '../_lib/server/load-user-workspace';
import { HomeAddAccountButton } from './home-add-account-button';

export function HomeAccountsList() {
  const { accounts, canCreateTeamAccount } = use(loadUserWorkspace());

  if (!accounts.length) {
    return (
      <HomeAccountsListEmptyState canCreateTeamAccount={canCreateTeamAccount} />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {accounts.map((account) => (
          <CardButton key={account.value} asChild>
            <Link href={`/home/${account.value}`}>
              <CardButtonHeader>
                <CardButtonTitle>{account.label}</CardButtonTitle>
              </CardButtonHeader>
            </Link>
          </CardButton>
        ))}
      </div>
    </div>
  );
}

function HomeAccountsListEmptyState(props: {
  canCreateTeamAccount: { allowed: boolean; reason?: string };
}) {
  return (
    <div className={'flex flex-1'}>
      <EmptyState>
        <EmptyStateButton asChild>
          <HomeAddAccountButton
            className={'mt-4'}
            canCreateTeamAccount={props.canCreateTeamAccount}
          />
        </EmptyStateButton>
        <EmptyStateHeading>
          <Trans i18nKey={'account:noTeamsYet'} />
        </EmptyStateHeading>
        <EmptyStateText>
          <Trans i18nKey={'account:createTeam'} />
        </EmptyStateText>
      </EmptyState>
    </div>
  );
}
