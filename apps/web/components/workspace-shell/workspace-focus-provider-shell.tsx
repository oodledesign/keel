'use client';

import { useMemo } from 'react';

import type { WorkspaceFocusInput } from '~/lib/workspace-focus';
import { deserializeWorkspaceFocusMap } from '~/lib/workspace-focus/serialize-focus-map';

import { PlatformSupportMessengerProvider } from './platform-support-messenger-context';
import { WorkspaceFocusProvider } from './workspace-focus-context';
import { WorkspaceHolidayReturnWatcher } from './workspace-holiday-return-watcher';
import {
  WorkspaceOooDialogProvider,
  type WorkspaceOooWorkspaceOption,
} from './workspace-ooo-dialog-context';

export function WorkspaceFocusProviderShell({
  children,
  settingsByAccountId,
  supportDefaultAccountId = null,
  oooWorkspaces = [],
  oooDefaultAccountId = null,
}: React.PropsWithChildren<{
  settingsByAccountId: Record<string, WorkspaceFocusInput>;
  /** Pre-select this workspace in new support conversations when present. */
  supportDefaultAccountId?: string | null;
  /** Workspaces available for the out-of-office quick dialog. */
  oooWorkspaces?: WorkspaceOooWorkspaceOption[];
  oooDefaultAccountId?: string | null;
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
        <WorkspaceOooDialogProvider
          workspaces={oooWorkspaces}
          defaultAccountId={oooDefaultAccountId ?? supportDefaultAccountId}
        >
          <WorkspaceHolidayReturnWatcher />
          {children}
        </WorkspaceOooDialogProvider>
      </PlatformSupportMessengerProvider>
    </WorkspaceFocusProvider>
  );
}
