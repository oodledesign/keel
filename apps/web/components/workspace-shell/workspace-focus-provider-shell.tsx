'use client';

import { useMemo } from 'react';

import type { WorkspaceFocusInput } from '~/lib/workspace-focus';
import { deserializeWorkspaceFocusMap } from '~/lib/workspace-focus/serialize-focus-map';

import { PlatformSupportMessengerProvider } from './platform-support-messenger-context';
import { WorkspaceFocusProvider } from './workspace-focus-context';

export function WorkspaceFocusProviderShell({
  children,
  settingsByAccountId,
  supportDefaultAccountId = null,
}: React.PropsWithChildren<{
  settingsByAccountId: Record<string, WorkspaceFocusInput>;
  /** Pre-select this workspace in new support conversations when present. */
  supportDefaultAccountId?: string | null;
}>) {
  const map = useMemo(
    () => deserializeWorkspaceFocusMap(settingsByAccountId),
    [settingsByAccountId],
  );

  return (
    <WorkspaceFocusProvider settingsByAccountId={map}>
      <PlatformSupportMessengerProvider
        defaultAccountId={supportDefaultAccountId}
      >
        {children}
      </PlatformSupportMessengerProvider>
    </WorkspaceFocusProvider>
  );
}
