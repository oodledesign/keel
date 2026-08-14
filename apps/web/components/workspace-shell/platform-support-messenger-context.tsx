'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { PlatformSupportMessenger } from '~/components/workspace-shell/platform-support-messenger';

export type PlatformSupportMessengerView =
  | 'home'
  | 'messages'
  | 'new'
  | 'thread';

export type OpenPlatformSupportMessengerOptions = {
  view?: Exclude<PlatformSupportMessengerView, 'thread'>;
  accountId?: string | null;
};

type PlatformSupportMessengerContextValue = {
  open: boolean;
  view: Exclude<PlatformSupportMessengerView, 'thread'>;
  defaultAccountId: string | null;
  openMessenger: (options?: OpenPlatformSupportMessengerOptions) => void;
  openNewConversation: (accountId?: string | null) => void;
  setOpen: (open: boolean) => void;
};

const PlatformSupportMessengerContext =
  createContext<PlatformSupportMessengerContextValue | null>(null);

export function PlatformSupportMessengerProvider({
  children,
  defaultAccountId = null,
}: React.PropsWithChildren<{
  defaultAccountId?: string | null;
}>) {
  const [open, setOpen] = useState(false);
  const [view, setView] =
    useState<Exclude<PlatformSupportMessengerView, 'thread'>>('home');
  const [accountId, setAccountId] = useState<string | null>(defaultAccountId);

  const openMessenger = useCallback(
    (options?: OpenPlatformSupportMessengerOptions) => {
      setView(options?.view ?? 'home');
      setAccountId(options?.accountId ?? defaultAccountId);
      setOpen(true);
    },
    [defaultAccountId],
  );

  const openNewConversation = useCallback(
    (nextAccountId?: string | null) => {
      openMessenger({
        view: 'new',
        accountId: nextAccountId ?? defaultAccountId,
      });
    },
    [defaultAccountId, openMessenger],
  );

  const value = useMemo(
    () => ({
      open,
      view,
      defaultAccountId: accountId,
      openMessenger,
      openNewConversation,
      setOpen,
    }),
    [open, view, accountId, openMessenger, openNewConversation],
  );

  return (
    <PlatformSupportMessengerContext.Provider value={value}>
      {children}
      <PlatformSupportMessenger
        open={open}
        onOpenChange={setOpen}
        defaultAccountId={accountId}
        initialView={view}
      />
    </PlatformSupportMessengerContext.Provider>
  );
}

export function usePlatformSupportMessenger() {
  return useContext(PlatformSupportMessengerContext);
}

/** Safe for call sites that may render outside the provider (e.g. admin). */
export function useOptionalPlatformSupportMessenger() {
  return useContext(PlatformSupportMessengerContext);
}
