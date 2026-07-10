import { ReactNode } from 'react';

export default function BookLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--ozer-surface-canvas,#FBF6EC)] text-[var(--ozer-plum-900,#351E28)]">
      {children}
    </div>
  );
}
