'use client';

import type { WorkspaceSpaceType } from '~/home/[account]/_lib/server/account-modules';

import { WorkspaceDesktopTopBar } from './workspace-top-bar-actions';

export function WorkspaceTopBar(
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
  return <WorkspaceDesktopTopBar {...props} />;
}
