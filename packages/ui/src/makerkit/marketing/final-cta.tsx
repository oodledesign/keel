import React from 'react';

import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from '../../shadcn/button';

interface FinalCtaProps {
  heading: string;
  subheading?: string;
  primaryCta?: {
    label: string;
    href: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
  /** Show arrow icon on primary CTA (default true). Set false to match design with text-only button. */
  primaryCtaShowArrow?: boolean;
  className?: string;
}

export function FinalCta({
  heading,
  subheading,
  primaryCta,
  secondaryCta,
  primaryCtaShowArrow = true,
  className,
}: FinalCtaProps) {
  return (
    <section className={cn('px-4 py-10 lg:px-8 lg:py-14', className)}>
      <div
        className={cn(
          'relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] px-6 py-14 text-center md:rounded-[2.5rem] md:px-12 md:py-20',
          'bg-[linear-gradient(115deg,var(--ozer-coral-600,#c2452a)_0%,var(--ozer-coral-500,#ff5c34)_42%,var(--ozer-coral-400,#ff7a5c)_78%,#ffb48c_100%)]',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: [
              'radial-gradient(ellipse 70% 80% at 12% 40%, rgba(255,255,255,0.28), transparent 55%)',
              'radial-gradient(ellipse 50% 60% at 88% 30%, rgba(255,224,214,0.45), transparent 50%)',
            ].join(','),
          }}
        />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="mb-4 text-3xl font-bold text-white lg:text-4xl">
            {heading}
          </h2>
          {subheading && (
            <p className="mb-8 text-lg text-white/90">{subheading}</p>
          )}

          {(primaryCta || secondaryCta) && (
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              {primaryCta && (
                <Button
                  asChild
                  className="h-12 rounded-full border-0 bg-white px-8 text-base font-semibold text-[var(--ozer-plum-950,#2a1720)] hover:bg-white/95"
                >
                  <Link href={primaryCta.href}>
                    {primaryCta.label}
                    {primaryCtaShowArrow && (
                      <ArrowRight className="ml-2 h-4 w-4" />
                    )}
                  </Link>
                </Button>
              )}

              {secondaryCta && (
                <Button
                  asChild
                  variant="outline"
                  className="h-12 rounded-full border-2 border-white/40 bg-transparent px-8 text-base font-semibold text-white hover:bg-white/10"
                >
                  <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
