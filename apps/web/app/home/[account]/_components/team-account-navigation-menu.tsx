import {
  BorderedNavigationMenu,
  BorderedNavigationMenuItem,
} from '@kit/ui/bordered-navigation-menu';

import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import { getTeamAccountSidebarConfig } from '~/config/team-account-navigation.config';
import pathsConfig from '~/config/paths.config';
import { TeamAccountAccountsSelector } from '~/home/[account]/_components/team-account-accounts-selector';

// local imports
import { TeamAccountWorkspace } from '../_lib/server/team-account-workspace.loader';

export function TeamAccountNavigationMenu(props: {
  workspace: TeamAccountWorkspace;
}) {
  const { account, user, accounts } = props.workspace;

  const routes = getTeamAccountSidebarConfig(
    account.slug,
    account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  ).routes.reduce<
    Array<{
      path: string;
      label: string;
      Icon?: React.ReactNode;
      end?: boolean | ((path: string) => boolean);
    }>
  >((acc, item) => {
    if ('children' in item) {
      return [...acc, ...item.children];
    }

    if ('divider' in item) {
      return acc;
    }

    return [...acc, item];
  }, []);

  return (
    <div className={'flex w-full flex-1 justify-between text-[#d7deee]'}>
      <div className="flex items-center space-x-8">
        <AppLogo
          href={
            account?.slug
              ? pathsConfig.app.accountHome.replace('[account]', account.slug)
              : undefined
          }
        />

        <BorderedNavigationMenu>
          {routes.map((route) => (
            <BorderedNavigationMenuItem {...route} key={route.path} />
          ))}
        </BorderedNavigationMenu>
      </div>

      <div className="flex items-center justify-end space-x-2.5">
        <TeamAccountAccountsSelector
          userId={user.id}
          selectedAccount={account.slug}
          accounts={accounts.map((account) => ({
            label: account.name,
            value: account.slug,
            image: account.picture_url,
          }))}
        />

        <div>
          <ProfileAccountDropdownContainer
            user={user}
            showProfileName={false}
          />
        </div>
      </div>
    </div>
  );
}
