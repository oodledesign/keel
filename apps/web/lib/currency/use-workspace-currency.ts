'use client';

import { useContext } from 'react';

import { TeamAccountWorkspaceContext } from '@kit/team-accounts/components';

import {
  type WorkspaceCurrency,
  normalizeWorkspaceCurrency,
} from '~/lib/currency/workspace-currency';

type WorkspaceContextValue = {
  defaultCurrency?: WorkspaceCurrency | string | null;
};

export function useWorkspaceCurrency(): WorkspaceCurrency {
  const ctx = useContext(TeamAccountWorkspaceContext) as WorkspaceContextValue;
  return normalizeWorkspaceCurrency(ctx.defaultCurrency);
}
