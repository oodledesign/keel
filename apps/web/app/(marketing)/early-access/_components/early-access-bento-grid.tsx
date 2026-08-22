'use client';

import { useState } from 'react';

import { ChevronDown } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  EARLY_ACCESS_ACCENT_CLASS,
  EARLY_ACCESS_ACCENT_SOFT_CLASS,
  EARLY_ACCESS_BENTO_FEATURES,
  EARLY_ACCESS_STATUS_LABEL,
  type EarlyAccessAccent,
} from '~/lib/marketing/early-access-content';
import {
  marketingBtnPress,
  marketingCard,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

function BentoCard({
  title,
  desc,
  status,
  accent,
  wide,
}: {
  title: string;
  desc: string;
  status: 'live' | 'soon' | 'addon';
  accent: EarlyAccessAccent;
  wide?: boolean;
}) {
  const statusLabel = EARLY_ACCESS_STATUS_LABEL[status];

  return (
    <div
      className={cn(
        marketingCard,
        'flex min-h-32 flex-col rounded-[1.5rem] p-5 md:p-6',
        wide && 'sm:col-span-2',
        status === 'soon' &&
          'bg-[repeating-linear-gradient(135deg,var(--workspace-shell-panel),var(--workspace-shell-panel)_10px,var(--workspace-shell-canvas)_10px,var(--workspace-shell-canvas)_11px)]',
      )}
    >
      <div className="mb-3.5 flex items-center justify-between">
        <span
          className={cn(
            'size-2.5 rounded-full',
            EARLY_ACCESS_ACCENT_CLASS[accent],
          )}
          aria-hidden
        />
        {statusLabel ? (
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.03em] uppercase',
              status === 'addon'
                ? 'bg-[var(--workspace-shell-text)] text-[var(--workspace-shell-canvas)]'
                : EARLY_ACCESS_ACCENT_SOFT_CLASS[accent],
            )}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>
      <p className="mb-1.5 text-[15px] font-extrabold text-[var(--workspace-shell-text)]">
        {title}
      </p>
      <p className={`text-[13px] leading-relaxed ${marketingMutedText}`}>
        {desc}
      </p>
    </div>
  );
}

export function EarlyAccessBentoGrid() {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll
    ? EARLY_ACCESS_BENTO_FEATURES
    : EARLY_ACCESS_BENTO_FEATURES.slice(0, 6);

  return (
    <div className="w-full">
      <div className="grid grid-flow-dense grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
        {visible.map((feature) => (
          <BentoCard key={feature.title} {...feature} />
        ))}
      </div>
      <button
        type="button"
        className={cn(
          'mx-auto mt-7 flex items-center gap-2 rounded-full border border-[color:var(--workspace-shell-border)] px-5 py-2.5 text-sm font-bold text-[var(--workspace-shell-text)]',
          'hover:border-[color:var(--workspace-shell-text)]',
          'focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:ring-offset-2 focus-visible:outline-none',
          marketingBtnPress,
        )}
        aria-expanded={showAll}
        data-test="early-access-bento-toggle"
        onClick={() => setShowAll((value) => !value)}
      >
        {showAll
          ? 'Show fewer'
          : `See all ${EARLY_ACCESS_BENTO_FEATURES.length} features`}
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform duration-200',
            showAll && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
    </div>
  );
}
