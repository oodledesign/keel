import { cn } from '@kit/ui/utils';

import {
  COMMERCIAL_HOME_PAIN_FIX,
  COMMERCIAL_HOME_PAIN_FIX_HEADING,
} from '~/lib/marketing/commercial-home-content';
import { marketingRule } from '~/lib/marketing/marketing-ui';

import { MarketingSectionHeader } from '../marketing-section-index';

const LEDGER_GRID =
  'grid gap-x-10 gap-y-2 md:grid-cols-[3rem_minmax(0,5fr)_minmax(0,6fr)]';

export function PainFixSection() {
  const heading = COMMERCIAL_HOME_PAIN_FIX_HEADING;

  return (
    <section
      className="mx-auto w-full max-w-[88rem] px-6 pt-20 pb-8 md:pt-28"
      aria-labelledby="pain-fix-heading"
    >
      <MarketingSectionHeader
        index="01"
        label={heading.label}
        title={heading.title}
        intro={heading.intro}
        headingId="pain-fix-heading"
      />

      <div className="mt-14 md:mt-20">
        <div
          className={cn(
            LEDGER_GRID,
            'hidden pb-3 text-[0.8125rem] font-medium text-[var(--workspace-shell-text-muted)] md:grid',
          )}
          aria-hidden="true"
        >
          <span />
          <span>{heading.beforeLabel}</span>
          <span>{heading.afterLabel}</span>
        </div>

        <ol className={cn(marketingRule, 'border-b')}>
          {COMMERCIAL_HOME_PAIN_FIX.map((item, index) => (
            <li
              key={item.pain}
              className={cn(
                LEDGER_GRID,
                marketingRule,
                'border-t py-6 md:items-baseline md:py-8',
              )}
            >
              <span className="text-[0.8125rem] font-medium text-[var(--workspace-shell-text-muted)] tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="text-[0.9375rem] leading-relaxed text-[var(--workspace-shell-text-muted)] md:text-base">
                <span className="font-medium md:sr-only">
                  {heading.beforeLabel}:{' '}
                </span>
                {item.pain}
              </p>
              <p className="font-heading mt-2 text-[1.25rem] leading-[1.3] font-medium tracking-[-0.01em] text-[var(--workspace-shell-text)] md:mt-0 md:text-[1.5rem]">
                <span className="sr-only">{heading.afterLabel}: </span>
                {item.fix}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
