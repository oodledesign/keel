'use client';

import { useMemo } from 'react';

import type { WorkspaceFocusInput } from '~/lib/workspace-focus';

import {
  deserializeWorkspaceFocusMap,
  WorkspaceFocusProvider,
} from './workspace-focus-context';

export function WorkspaceFocusProviderShell({
  children,
  settingsByAccountId,
}: React.PropsWithChildren<{
  settingsByAccountId: Record<string, WorkspaceFocusInput>;
}>) {
  const map = useMemo(
    () => deserializeWorkspaceFocusMap(settingsByAccountId),
    [settingsByAccountId],
  );

  return (
    <WorkspaceFocusProvider settingsByAccountId={map}>
      {children}
    </WorkspaceFocusProvider>
  );
}
