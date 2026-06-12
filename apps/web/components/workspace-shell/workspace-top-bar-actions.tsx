'use client';

import { NotificationsPopover } from '@kit/notifications/components';

import featureFlagsConfig from '~/config/feature-flags.config';

import { WorkspaceSearchButton } from './workspace-search-button';
import { WorkspaceNewMenu } from './workspace-new-menu';
import type { WorkspaceSpaceType } from '~/home/[account]/_lib/server/account-modules';

export function WorkspaceMobileTopActions(
  props:
    | {
        variant: 'team';
        userId: string;
        accountId: string;
        accountSlug: string;
        spaceType?: WorkspaceSpaceType;
        showNewMenu?: boolean;
      }
    | {
        variant: 'personal';
        userId: string;
        accountId?: string;
        showNewMenu?: boolean;
      },
) {
  const notificationAccountIds = [
    props.userId,
    props.variant === 'team' ? props.accountId : props.accountId,
  ].filter((id): id is string => Boolean(id));

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
    | {
        variant: 'team';
        userId: string;
        accountId: string;
        accountSlug: string;
        spaceType?: WorkspaceSpaceType;
        showNewMenu?: boolean;
      }
    | {
        variant: 'personal';
        userId: string;
        accountId?: string;
        showNewMenu?: boolean;
      },
) {
  const showNew = props.showNewMenu ?? true;
  const notificationAccountIds = [
    props.userId,
    props.variant === 'team' ? props.accountId : props.accountId,
  ].filter((id): id is string => Boolean(id));

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
      </div>
    </header>
  );
}
