'use client';

import { type ReactNode, createContext, useContext } from 'react';

import type {
  WebsiteStyleSystem,
  WebsiteStyleTokens,
} from '~/lib/websites/style-tokens';

export type SiteStyleLiveContextValue = {
  accountId: string;
  websiteId: string;
  tokens: WebsiteStyleTokens;
  styleBase?: WebsiteStyleSystem | null;
  canEdit: boolean;
  onTokensChange: (tokens: WebsiteStyleTokens) => void;
};

const SiteStyleLiveContext = createContext<SiteStyleLiveContextValue | null>(
  null,
);

export function SiteStyleLiveProvider({
  value,
  children,
}: {
  value: SiteStyleLiveContextValue;
  children: ReactNode;
}) {
  return (
    <SiteStyleLiveContext.Provider value={value}>
      {children}
    </SiteStyleLiveContext.Provider>
  );
}

export function useSiteStyleLive() {
  return useContext(SiteStyleLiveContext);
}
