'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { WorkspaceOooQuickDialog } from './workspace-ooo-quick-dialog';

export type WorkspaceOooWorkspaceOption = {
  id: string;
  slug: string;
  name: string;
};

type WorkspaceOooDialogContextValue = {
  open: boolean;
  openOooDialog: (accountId?: string | null) => void;
  setOpen: (open: boolean) => void;
};

const WorkspaceOooDialogContext =
  createContext<WorkspaceOooDialogContextValue | null>(null);

export function WorkspaceOooDialogProvider({
  children,
  workspaces,
  defaultAccountId = null,
}: React.PropsWithChildren<{
  workspaces: WorkspaceOooWorkspaceOption[];
  defaultAccountId?: string | null;
}>) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(
    defaultAccountId ?? workspaces[0]?.id ?? null,
  );

  const resolvedAccountId = useMemo(() => {
    if (accountId && workspaces.some((workspace) => workspace.id === accountId)) {
      return accountId;
    }

    if (
      defaultAccountId &&
      workspaces.some((workspace) => workspace.id === defaultAccountId)
    ) {
      return defaultAccountId;
    }

    return workspaces[0]?.id ?? null;
  }, [accountId, defaultAccountId, workspaces]);

  const accountSlug = useMemo(() => {
    return (
      workspaces.find((workspace) => workspace.id === resolvedAccountId)
        ?.slug ?? null
    );
  }, [resolvedAccountId, workspaces]);

  const openOooDialog = useCallback(
    (nextAccountId?: string | null) => {
      const preferred =
        nextAccountId &&
        workspaces.some((workspace) => workspace.id === nextAccountId)
          ? nextAccountId
          : (defaultAccountId ?? workspaces[0]?.id ?? null);

      setAccountId(preferred);
      setOpen(true);
    },
    [defaultAccountId, workspaces],
  );

  const value = useMemo(
    () => ({
      open,
      openOooDialog,
      setOpen,
    }),
    [open, openOooDialog],
  );

  if (workspaces.length === 0) {
    return children;
  }

  return (
    <WorkspaceOooDialogContext.Provider value={value}>
      {children}
      <WorkspaceOooQuickDialog
        open={open}
        onOpenChange={setOpen}
        accountId={resolvedAccountId}
        accountSlug={accountSlug}
        workspaces={workspaces}
        onAccountChange={setAccountId}
      />
    </WorkspaceOooDialogContext.Provider>
  );
}

export function useWorkspaceOooDialog() {
  const ctx = useContext(WorkspaceOooDialogContext);
  if (!ctx) {
    throw new Error(
      'useWorkspaceOooDialog must be used within WorkspaceOooDialogProvider',
    );
  }
  return ctx;
}

export function useOptionalWorkspaceOooDialog() {
  return useContext(WorkspaceOooDialogContext);
}
