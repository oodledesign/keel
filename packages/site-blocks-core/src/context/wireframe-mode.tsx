'use client';

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';

const WireframeModeContext = createContext(false);

export function WireframeModeProvider({
  wireframe,
  children,
}: {
  wireframe: boolean;
  children: ReactNode;
}) {
  return (
    <WireframeModeContext.Provider value={wireframe}>
      {children}
    </WireframeModeContext.Provider>
  );
}

export function useWireframeMode(override?: boolean) {
  const fromContext = useContext(WireframeModeContext);
  return override ?? fromContext;
}
