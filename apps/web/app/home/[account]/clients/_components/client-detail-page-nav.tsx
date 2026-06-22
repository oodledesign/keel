'use client';

import Link from 'next/link';

import { ChevronRight, Home } from 'lucide-react';

export function ClientDetailPageNav({
  accountHomeHref,
  clientsListHref,
  clientDisplayName,
}: {
  accountHomeHref: string;
  clientsListHref: string;
  clientDisplayName: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-400"
    >
      <Link
        href={accountHomeHref}
        className="inline-flex items-center transition hover:text-white"
        aria-label="Home"
      >
        <Home className="h-4 w-4" />
      </Link>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
      <Link href={clientsListHref} className="transition hover:text-white">
        Clients
      </Link>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
      <span className="truncate font-medium text-white">{clientDisplayName}</span>
    </nav>
  );
}
