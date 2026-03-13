'use client';

import Link from 'next/link';

import { ChevronLeft } from 'lucide-react';

export function ClientDetailPageNav({
  accountSlug,
  clientsListHref,
}: {
  accountSlug: string;
  clientsListHref: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={clientsListHref}
        className="flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to clients
      </Link>
    </div>
  );
}
