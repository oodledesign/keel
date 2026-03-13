import { ReactNode } from 'react';

/**
 * Portal layout: minimal wrapper for public invoice view.
 * No auth required; no sidebar.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {children}
    </div>
  );
}
