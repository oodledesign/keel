'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { usePathname } from 'next/navigation';

import { QuickActionDialog } from './quick-action-dialog';

type QuickActionContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const QuickActionContext = createContext<QuickActionContextValue | null>(null);

export function useQuickAction() {
  const ctx = useContext(QuickActionContext);
  if (!ctx) {
    throw new Error('useQuickAction must be used within QuickActionProvider');
  }
  return ctx;
}

function parsePageContext(pathname: string | null): {
  accountId?: string;
  accountSlug?: string;
} {
  if (!pathname) return {};

  const teamMatch = pathname.match(/^\/app\/work\/([^/]+)/);
  if (teamMatch?.[1]) {
    return { accountSlug: teamMatch[1] };
  }

  return {};
}

function isQuickActionRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith('/app') || pathname.startsWith('/home');
}

export function QuickActionProvider(props: React.PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const pageContext = useMemo(() => parsePageContext(pathname), [pathname]);
  const enabled = isQuickActionRoute(pathname);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      if (event.key.toLowerCase() !== 'k') return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA' ||
          event.target.tagName === 'SELECT')
      ) {
        return;
      }
      event.preventDefault();
      setOpen((current) => !current);
    },
    [enabled],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const value = useMemo(
    () => ({
      open,
      setOpen,
    }),
    [open],
  );

  return (
    <QuickActionContext.Provider value={value}>
      {props.children}
      {enabled ? (
        <QuickActionDialog
          open={open}
          onOpenChange={setOpen}
          pageContext={pageContext}
        />
      ) : null}
    </QuickActionContext.Provider>
  );
}
