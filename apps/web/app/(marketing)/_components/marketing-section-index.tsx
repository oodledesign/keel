import { cn } from '@kit/ui/utils';

import {
  marketingLede,
  marketingRule,
  marketingRuleOnDark,
  marketingSectionHeading,
} from '~/lib/marketing/marketing-ui';

/** Index marker, then a serif heading on the left and the intro set to the right. */
export function MarketingSectionHeader({
  index,
  label,
  title,
  intro,
  headingId,
  tone = 'light',
  className,
}: {
  index?: string;
  label: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  headingId: string;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const onDark = tone === 'dark';

  return (
    <div className={className}>
      <MarketingSectionIndex index={index} label={label} tone={tone} />
      <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
        <h2
          id={headingId}
          className={cn(
            marketingSectionHeading,
            'lg:col-span-7',
            onDark
              ? 'text-[var(--ozer-text-on-dark)]'
              : 'text-[var(--workspace-shell-text)]',
          )}
        >
          {title}
        </h2>
        {intro ? (
          <p
            className={cn(
              marketingLede,
              'lg:col-span-4 lg:col-start-9',
              onDark
                ? 'text-[var(--ozer-text-on-dark-muted)]'
                : 'text-[var(--workspace-shell-text-muted)]',
            )}
          >
            {intro}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** "01 / Portals" above a hairline rule — replaces pill eyebrows. */
export function MarketingSectionIndex({
  index,
  label,
  aside,
  tone = 'light',
  className,
}: {
  index?: string;
  label: string;
  aside?: React.ReactNode;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline gap-3 border-b pb-3 text-[0.8125rem] font-medium',
        tone === 'dark'
          ? cn(marketingRuleOnDark, 'text-[var(--ozer-text-on-dark-muted)]')
          : cn(
              marketingRule,
              'text-[var(--ozer-text-on-light-muted)] dark:text-[var(--ozer-text-on-dark-muted)]',
            ),
        className,
      )}
    >
      {index ? (
        <>
          <span
            className={cn(
              'tabular-nums',
              tone === 'dark'
                ? 'text-[var(--ozer-text-on-dark)]'
                : 'text-[var(--ozer-plum-950)] dark:text-[var(--ozer-text-on-dark)]',
            )}
          >
            {index}
          </span>
          <span aria-hidden="true">/</span>
        </>
      ) : null}
      <span>{label}</span>
      {aside ? <span className="ml-auto">{aside}</span> : null}
    </div>
  );
}
