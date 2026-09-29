import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  COMMERCIAL_HOME_WORKSPACES,
  type CommercialWorkspaceStripItem,
} from '~/lib/marketing/commercial-home-content';
import {
  marketingFeatureCard,
  marketingMutedText,
  marketingSectionHeading,
} from '~/lib/marketing/marketing-ui';

const STATUS_LABEL: Record<CommercialWorkspaceStripItem['status'], string> = {
  live: 'Live',
  free: 'Free',
  soon: 'Coming soon',
};

const STATUS_CLASS: Record<CommercialWorkspaceStripItem['status'], string> = {
  live: 'bg-[var(--ozer-sage-100)] text-[var(--ozer-plum-700)]',
  free: 'bg-[var(--ozer-sky-100)] text-[var(--ozer-cool-blue)]',
  soon: 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
};

function WorkspaceCard({ item }: { item: CommercialWorkspaceStripItem }) {
  return (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="font-semibold text-[var(--workspace-shell-text)]">
          {item.label}
        </span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-[0.03em] uppercase',
            STATUS_CLASS[item.status],
          )}
        >
          {STATUS_LABEL[item.status]}
        </span>
      </span>
      <span
        className={cn('mt-2 block text-sm leading-relaxed', marketingMutedText)}
      >
        {item.description}
      </span>
      {item.href ? (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--ozer-accent)]">
          Explore
          <ArrowRight className="size-3.5" aria-hidden />
        </span>
      ) : null}
    </>
  );
}

export function WorkspacesStrip() {
  return (
    <section
      className="mx-auto w-full max-w-7xl px-6 py-16 md:py-20"
      aria-labelledby="workspaces-strip-heading"
    >
      <div className="mb-8 max-w-2xl">
        <h2
          id="workspaces-strip-heading"
          className={cn(
            marketingSectionHeading,
            'text-[var(--workspace-shell-text)]',
          )}
        >
          Not a commercial agent?
        </h2>
        <p className={cn('mt-3 text-base leading-relaxed', marketingMutedText)}>
          Ozer runs other kinds of work too — one login, with tasks and the
          planner connected across every workspace.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COMMERCIAL_HOME_WORKSPACES.map((item) => {
          const cardClass = cn(
            'flex h-full flex-col rounded-2xl border border-[color:var(--workspace-shell-border)] p-5',
            marketingFeatureCard,
          );

          return (
            <li key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    cardClass,
                    'transition-colors hover:border-[color:var(--ozer-accent)]/40',
                  )}
                >
                  <WorkspaceCard item={item} />
                </Link>
              ) : (
                <div className={cn(cardClass, 'opacity-80')}>
                  <WorkspaceCard item={item} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
