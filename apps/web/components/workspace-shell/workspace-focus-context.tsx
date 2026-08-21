'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import type { WorkspaceFocusInput } from '~/lib/workspace-focus';

type WorkspaceFocusContextValue = {
  byAccountId: Map<string, WorkspaceFocusInput>;
  patchSettings: (
    accountId: string,
    patch: Partial<WorkspaceFocusInput>,
  ) => void;
  replaceSettings: (
    accountId: string,
    settings: WorkspaceFocusInput | null,
  ) => void;
};

const WorkspaceFocusContext = createContext<WorkspaceFocusContextValue>({
  byAccountId: new Map(),
  patchSettings: () => undefined,
  replaceSettings: () => undefined,
});

export function WorkspaceFocusProvider({
  children,
  settingsByAccountId,
}: React.PropsWithChildren<{
  settingsByAccountId: Map<string, WorkspaceFocusInput>;
}>) {
  const [overrides, setOverrides] = useState<Map<string, WorkspaceFocusInput>>(
    () => new Map(),
  );

  const byAccountId = useMemo(() => {
    const merged = new Map(settingsByAccountId);

    for (const [accountId, settings] of overrides) {
      merged.set(accountId, settings);
    }

    return merged;
  }, [overrides, settingsByAccountId]);

  const replaceSettings = useCallback(
    (accountId: string, settings: WorkspaceFocusInput | null) => {
      setOverrides((current) => {
        const next = new Map(current);

        if (!settings) {
          next.delete(accountId);
        } else {
          next.set(accountId, {
            ...settings,
            account_id: settings.account_id ?? accountId,
          });
        }

        return next;
      });
    },
    [],
  );

  const patchSettings = useCallback(
    (accountId: string, patch: Partial<WorkspaceFocusInput>) => {
      setOverrides((current) => {
        const base =
          current.get(accountId) ?? settingsByAccountId.get(accountId) ?? null;

        if (!base) {
          return current;
        }

        const next = new Map(current);
        next.set(accountId, {
          ...base,
          ...patch,
          account_id: base.account_id ?? accountId,
        });
        return next;
      });
    },
    [settingsByAccountId],
  );

  const value = useMemo(
    () => ({ byAccountId, patchSettings, replaceSettings }),
    [byAccountId, patchSettings, replaceSettings],
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

export function useWorkspaceFocusSettingsMap(): Map<
  string,
  WorkspaceFocusInput
> {
  return useContext(WorkspaceFocusContext).byAccountId;
}

export function useWorkspaceFocusSettingsMutations() {
  const { patchSettings, replaceSettings } = useContext(WorkspaceFocusContext);
  return { patchSettings, replaceSettings };
}
