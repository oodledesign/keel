import Link from 'next/link';

import { Coins, Layers } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

export function PortalServicesTabs({
  clientSlug,
  active,
}: {
  clientSlug: string;
  active: 'requests' | 'credits';
}) {
  const servicesHref = pathsConfig.app.clientPortalSupport.replace(
    '[clientSlug]',
    clientSlug,
  );
  const creditsHref = pathsConfig.app.clientPortalCredits.replace(
    '[clientSlug]',
    clientSlug,
  );

  const itemClass = (selected: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium',
      selected
        ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
        : 'text-[var(--ozer-text-on-light-muted)] hover:text-[var(--ozer-text-on-light)]',
    );

  return (
    <div className="flex w-fit items-center gap-0.5 rounded-md border border-[color:var(--workspace-shell-border)] p-0.5">
      <Link href={servicesHref} className={itemClass(active === 'requests')}>
        <Layers className="h-3.5 w-3.5" />
        Requests
      </Link>
      <Link href={creditsHref} className={itemClass(active === 'credits')}>
        <Coins className="h-3.5 w-3.5" />
        Credits
      </Link>
    </div>
  );
}
