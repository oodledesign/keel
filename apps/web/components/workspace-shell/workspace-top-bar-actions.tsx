'use client';

import { useMemo } from 'react';

import { NotificationsPopover } from '@kit/notifications/components';
import type { JWTUserData } from '@kit/supabase/types';

import { ProfileAccountDropdownContainer } from '~/components/personal-account-dropdown-container';
import featureFlagsConfig from '~/config/feature-flags.config';

import { WorkspaceSearchButton } from './workspace-search-button';
import { WorkspaceNewMenu } from './workspace-new-menu';
import type { WorkspaceSpaceType } from '~/home/[account]/_lib/server/account-modules';

type WorkspaceTopBarBaseProps = {
  userId: string;
  user?: JWTUserData | null;
  account?: {
    id: string | null;
    name: string | null;
    picture_url: string | null;
  };
  showNewMenu?: boolean;
};

export function WorkspaceMobileTopActions(
  props:
    | ({
        variant: 'team';
        accountId: string;
        accountSlug: string;
        spaceType?: WorkspaceSpaceType;
      } & WorkspaceTopBarBaseProps)
    | ({
        variant: 'personal';
        accountId?: string;
      } & WorkspaceTopBarBaseProps),
) {
  const notificationAccountIds = useMemo(
    () =>
      [props.userId, props.accountId].filter((id): id is string => Boolean(id)),
    [props.accountId, props.userId],
  );

  return (
    <div className="flex shrink-0 items-center gap-1">
      {featureFlagsConfig.enableNotifications ? (
        <NotificationsPopover
          accountIds={notificationAccountIds}
          realtime={featureFlagsConfig.realtimeNotifications}
        />
      ) : null}
    </div>
  );
}

export function WorkspaceDesktopTopBar(
  props:
    | ({
        variant: 'team';
        accountId: string;
        accountSlug: string;
        spaceType?: WorkspaceSpaceType;
      } & WorkspaceTopBarBaseProps)
    | ({
        variant: 'personal';
        accountId?: string;
      } & WorkspaceTopBarBaseProps),
) {
  const showNew = props.showNewMenu ?? true;
  const notificationAccountIds = useMemo(
    () =>
      [props.userId, props.accountId].filter((id): id is string => Boolean(id)),
    [props.accountId, props.userId],
  );

  return (
    <header className="sticky top-0 z-30 hidden h-14 shrink-0 items-center justify-end gap-2 border-0 bg-transparent px-4 lg:flex lg:px-6">
      <div className="flex items-center gap-2">
        {featureFlagsConfig.enableNotifications ? (
          <NotificationsPopover
            accountIds={notificationAccountIds}
            realtime={featureFlagsConfig.realtimeNotifications}
          />
        ) : null}

        <WorkspaceSearchButton />

        {showNew ? (
          props.variant === 'team' ? (
            <WorkspaceNewMenu
              variant="team"
              account={props.accountSlug}
              spaceType={props.spaceType}
            />
          ) : (
            <WorkspaceNewMenu variant="personal" />
          )
        ) : null}

        {props.user ? (
          <ProfileAccountDropdownContainer
            user={props.user}
            account={props.account}
            showProfileName={false}
            className="shrink-0"
          />
        ) : null}
      </div>
    </header>
  );
}
