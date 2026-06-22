'use client';

import { createContext, useContext, useMemo } from 'react';

import type { WorkspaceFocusInput } from '~/lib/workspace-focus';

type WorkspaceFocusContextValue = {
  byAccountId: Map<string, WorkspaceFocusInput>;
};

const WorkspaceFocusContext = createContext<WorkspaceFocusContextValue>({
  byAccountId: new Map(),
});

export function WorkspaceFocusProvider({
  children,
  settingsByAccountId,
}: React.PropsWithChildren<{
  settingsByAccountId: Map<string, WorkspaceFocusInput>;
}>) {
  const value = useMemo(
    () => ({ byAccountId: settingsByAccountId }),
    [settingsByAccountId],
  );

  return (
    <WorkspaceFocusContext.Provider value={value}>
      {children}
    </WorkspaceFocusContext.Provider>
  );
}

export function useWorkspaceFocusSettings(
  accountId: string | null | undefined,
): WorkspaceFocusInput | null {
  const { byAccountId } = useContext(WorkspaceFocusContext);

  if (!accountId) {
    return null;
  }

  return byAccountId.get(accountId) ?? null;
}

export function useWorkspaceFocusSettingsMap(): Map<string, WorkspaceFocusInput> {
  return useContext(WorkspaceFocusContext).byAccountId;
}

export function serializeWorkspaceFocusMap(
  map: Map<string, WorkspaceFocusInput>,
): Record<string, WorkspaceFocusInput> {
  return Object.fromEntries(map.entries());
}

export function deserializeWorkspaceFocusMap(
  record: Record<string, WorkspaceFocusInput>,
): Map<string, WorkspaceFocusInput> {
  return new Map(Object.entries(record));
}
