'use client';

import type { JWTUserData } from '@kit/supabase/types';

import type { WorkspaceSpaceType } from '~/home/[account]/_lib/server/account-modules';

import { WorkspaceDesktopTopBar } from './workspace-top-bar-actions';

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

export function WorkspaceTopBar(
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
  return <WorkspaceDesktopTopBar {...props} />;
}
