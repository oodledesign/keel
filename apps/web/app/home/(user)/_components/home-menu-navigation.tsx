import {
  BorderedNavigationMenu,
  BorderedNavigationMenuItem,
} from '@kit/ui/bordered-navigation-menu';

import { AppLogo } from '~/components/app-logo';
import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import pathsConfig from '~/config/paths.config';
import {
  buildPersonalHomeNavRoutes,
  parsePersonalAccountNavigationConfig,
} from '~/config/personal-account-navigation.config';
import { APP_LOGO_SHELL_CLASSNAME } from '~/lib/app-logo-shell';

// home imports
import { type UserWorkspace } from '../_lib/server/load-user-workspace';

export function HomeMenuNavigation(props: { workspace: UserWorkspace }) {
  const { workspace, user, accounts } = props.workspace;
  const teamAccounts = Array.isArray(accounts) ? accounts : [];
  const navConfig = parsePersonalAccountNavigationConfig(
    buildPersonalHomeNavRoutes(),
  );

  const workspaceRoutes = teamAccounts.map((a) => ({
    path: pathsConfig.app.accountHome.replace('[account]', a.value),
    label: a.label,
    end: true as const,
  }));

  const routes = navConfig.routes.reduce<
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
    <div className={'flex w-full flex-1 justify-between'}>
      <div className="flex items-center space-x-8">
        <AppLogo className={APP_LOGO_SHELL_CLASSNAME} />

        <BorderedNavigationMenu>
          {routes.map((route) => (
            <BorderedNavigationMenuItem {...route} key={route.path} />
          ))}
          {workspaceRoutes.map((route) => (
            <BorderedNavigationMenuItem {...route} key={route.path} />
          ))}
        </BorderedNavigationMenu>
      </div>

      <div className="flex justify-end space-x-2.5">
        <div>
          <ProfileAccountDropdownContainer
            user={user}
            account={
              workspace
                ? {
                    id: workspace.id,
                    name: workspace.name,
                    picture_url: workspace.picture_url,
                  }
                : undefined
            }
            showProfileName={false}
          />
        </div>
      </div>
    </div>
  );
}
