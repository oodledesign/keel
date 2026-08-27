'use client';

import { createContext, useContext } from 'react';

type DisposalAccessContextValue = {
  canEditDisposals: boolean;
};

const DisposalAccessContext = createContext<DisposalAccessContextValue>({
  canEditDisposals: false,
});

export function DisposalAccessProvider({
  canEditDisposals,
  children,
}: {
  canEditDisposals: boolean;
  children: React.ReactNode;
}) {
  return (
    <DisposalAccessContext.Provider value={{ canEditDisposals }}>
      {children}
    </DisposalAccessContext.Provider>
  );
}

export function useDisposalAccess() {
  return useContext(DisposalAccessContext);
}
