import { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default function PollLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FBF6EC] text-[#351E28]">{children}</div>
  );
}
