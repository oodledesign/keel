import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import {
  COMMERCIAL_HOME_WORKSPACES,
  COMMERCIAL_HOME_WORKSPACES_HEADING,
  type CommercialWorkspaceStripItem,
} from '~/lib/marketing/commercial-home-content';
import { marketingRule } from '~/lib/marketing/marketing-ui';

import { MarketingSectionHeader } from '../marketing-section-index';

const STATUS_LABEL: Record<CommercialWorkspaceStripItem['status'], string> = {
  live: 'Live',
  free: 'Free',
  soon: 'Coming soon',
};

const ROW_GRID =
  'grid items-baseline gap-x-8 gap-y-1 py-6 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_7rem] md:py-7';

function WorkspaceRow({ item }: { item: CommercialWorkspaceStripItem }) {
  return (
    <>
      <span className="font-heading text-[1.625rem] leading-tight font-medium tracking-[-0.015em] text-[var(--workspace-shell-text)] md:text-[2rem]">
        {item.label}
      </span>
      <span className="text-[0.9375rem] leading-relaxed text-[var(--workspace-shell-text-muted)]">
        {item.description}
      </span>
      <span className="text-[0.8125rem] font-medium text-[var(--workspace-shell-text-muted)] sm:text-right">
        {STATUS_LABEL[item.status]}
        {item.href ? (
          <span
            className="ml-2 inline-block text-[var(--workspace-shell-text)] transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden="true"
          >
            →
          </span>
        ) : null}
      </span>
    </>
  );
}

export function WorkspacesStrip() {
  const heading = COMMERCIAL_HOME_WORKSPACES_HEADING;

  return (
    <section
      className="mx-auto w-full max-w-[88rem] px-6 py-20 md:py-28"
      aria-labelledby="workspaces-strip-heading"
    >
      <MarketingSectionHeader
        index="05"
        label={heading.label}
        title={heading.title}
        intro={heading.intro}
        headingId="workspaces-strip-heading"
      />

      <ul className={cn(marketingRule, 'mt-12 border-b md:mt-16')}>
        {COMMERCIAL_HOME_WORKSPACES.map((item) => (
          <li key={item.label} className={cn(marketingRule, 'border-t')}>
            {item.href ? (
              <Link
                href={item.href}
                className={cn(
                  ROW_GRID,
                  'group transition-colors duration-200 hover:bg-[var(--ozer-plum-alpha-08)] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none dark:hover:bg-[var(--ozer-on-dark-alpha-06)]',
                )}
              >
                <WorkspaceRow item={item} />
              </Link>
            ) : (
              <div className={cn(ROW_GRID, 'opacity-70')}>
                <WorkspaceRow item={item} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
