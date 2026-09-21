'use client';

import { createContext, useContext } from 'react';

type DisposalAccessContextValue = {
  canEditDisposals: boolean;
  epcConfigured: boolean;
};

const DisposalAccessContext = createContext<DisposalAccessContextValue>({
  canEditDisposals: false,
  epcConfigured: false,
});

export function DisposalAccessProvider({
  canEditDisposals,
  epcConfigured = false,
  children,
}: {
  canEditDisposals: boolean;
  epcConfigured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DisposalAccessContext.Provider value={{ canEditDisposals, epcConfigured }}>
      {children}
    </DisposalAccessContext.Provider>
  );
}

export function useDisposalAccess() {
  return useContext(DisposalAccessContext);
}
