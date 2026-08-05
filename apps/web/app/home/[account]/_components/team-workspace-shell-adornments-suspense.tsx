import { Suspense } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  loadTeamWorkspaceShellAdornments,
  type TeamWorkspaceShellAdornments,
} from '../_lib/server/team-workspace-shell-adornments.loader';

type Props = {
  client: SupabaseClient;
  userId: string;
  accountId: string;
  accountSlug: string;
  moduleSettings: Record<string, boolean>;
  focusAccountIds: string[];
  loadPipelineBoardName?: boolean;
  fallback: React.ReactNode;
  children: (adornments: TeamWorkspaceShellAdornments) => React.ReactNode;
};

async function TeamWorkspaceShellAdornmentsLoader({
  client,
  userId,
  accountId,
  accountSlug,
  moduleSettings,
  focusAccountIds,
  loadPipelineBoardName,
  children,
}: Omit<Props, 'fallback'>) {
  const adornments = await loadTeamWorkspaceShellAdornments({
    client,
    userId,
    accountId,
    accountSlug,
    moduleSettings,
    focusAccountIds,
    loadPipelineBoardName,
  });

  return <>{children(adornments)}</>;
}

export function TeamWorkspaceShellAdornmentsSuspense({
  fallback,
  children,
  ...loaderProps
}: Props) {
  return (
    <Suspense fallback={fallback}>
      <TeamWorkspaceShellAdornmentsLoader {...loaderProps}>
        {children}
      </TeamWorkspaceShellAdornmentsLoader>
    </Suspense>
  );
}
