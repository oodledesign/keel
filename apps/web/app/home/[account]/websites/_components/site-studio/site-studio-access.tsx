'use client';

import { createContext, useContext } from 'react';

const SiteStudioAccessContext = createContext(false);

export function SiteStudioAccessProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <SiteStudioAccessContext.Provider value={enabled}>
      {children}
    </SiteStudioAccessContext.Provider>
  );
}

/** Client-safe Site Studio entitlement flag for the websites detail shell. */
export function useSiteStudioAccess() {
  return useContext(SiteStudioAccessContext);
}
