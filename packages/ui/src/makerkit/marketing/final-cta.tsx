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
    <section
      className={cn(
        'bg-[#57C87F] px-4 py-16 lg:px-8 lg:py-24',
        className,
      )}
    >
      <div className="container mx-auto">
        <div className="mx-auto max-w-3xl text-center">
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
                  className="h-12 rounded-lg border-2 border-white bg-white px-8 text-base font-semibold text-[#57C87F] hover:bg-gray-50"
                >
                  <Link href={primaryCta.href}>
                    {primaryCta.label}
                    {primaryCtaShowArrow && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Link>
                </Button>
              )}

              {secondaryCta && (
                <Button
                  asChild
                  variant="outline"
                  className="h-12 rounded-lg border-2 border-white/30 bg-transparent px-8 text-base font-semibold text-white hover:bg-white/10"
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
