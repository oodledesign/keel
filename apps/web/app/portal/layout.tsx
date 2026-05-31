import { ReactNode } from 'react';

/**
 * Portal layout: public invoice views and authenticated client portal routes.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {children}
    </div>
  );
}
