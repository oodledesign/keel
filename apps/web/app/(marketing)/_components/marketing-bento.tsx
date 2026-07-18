import type { ReactNode } from 'react';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@kit/ui/utils';

export type MarketingBentoSpan = 'sm' | 'md' | 'lg' | 'cta' | 'wide' | 'tall';

export type MarketingBentoVariant = 'cream' | 'accent' | 'muted';

const spanClass: Record<MarketingBentoSpan, string> = {
  sm: 'md:col-span-1 md:row-span-1',
  md: 'md:col-span-1 md:row-span-2',
  lg: 'md:col-span-2 md:row-span-1',
  wide: 'md:col-span-2 md:row-span-1',
  tall: 'md:col-span-1 md:row-span-2',
  cta: 'md:col-span-1 md:row-span-2',
};

const variantClass: Record<MarketingBentoVariant, string> = {
  cream:
    'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]',
  muted:
    'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]',
  accent:
    'border-transparent bg-[linear-gradient(145deg,var(--ozer-coral-500)_0%,var(--ozer-coral-400)_55%,#ffb08a_100%)] text-[var(--ozer-cream-50)] shadow-[0_18px_50px_var(--ozer-coral-alpha-45)]',
};

export function MarketingBentoGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid auto-rows-[minmax(11rem,auto)] grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MarketingBentoTile({
  span = 'sm',
  variant = 'cream',
  href,
  className,
  children,
  visual,
}: {
  span?: MarketingBentoSpan;
  variant?: MarketingBentoVariant;
  href?: string;
  className?: string;
  children: ReactNode;
  visual?: ReactNode;
}) {
  const classes = cn(
    'group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border p-5 md:p-6',
    'transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
    spanClass[span],
    variantClass[variant],
    href && 'cursor-pointer hover:-translate-y-0.5',
    className,
  );

  const body = (
    <>
      {visual ? (
        <div className="mb-4 flex min-h-[4.5rem] flex-1 items-center justify-center">
          {visual}
        </div>
      ) : null}
      <div className={cn('mt-auto', visual && 'relative z-[1]')}>{children}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  return <article className={classes}>{body}</article>;
}

export function MarketingBentoAccentCta({
  title,
  description,
  href,
  ctaLabel = 'Start free',
}: {
  title: string;
  description: string;
  href: string;
  ctaLabel?: string;
}) {
  return (
    <MarketingBentoTile span="cta" variant="accent" href={href}>
      <div className="mb-6 flex justify-start">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--ozer-cream-50)] text-[var(--ozer-coral-600)] shadow-sm transition-transform duration-200 group-hover:scale-105">
          <ArrowUpRight className="size-5" aria-hidden />
        </span>
      </div>
      <h3 className="font-heading text-2xl leading-tight font-bold md:text-[1.75rem]">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ozer-cream-50)]/90">
        {description}
      </p>
      <span className="mt-6 inline-flex items-center text-sm font-semibold">
        {ctaLabel}
        <ArrowUpRight className="ml-1 size-4" aria-hidden />
      </span>
    </MarketingBentoTile>
  );
}
