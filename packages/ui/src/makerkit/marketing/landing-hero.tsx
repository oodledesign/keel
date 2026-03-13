import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { ArrowRightIcon, Check } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from '../../shadcn/button';
// Brand config import removed - using direct colors for now

interface LandingHeroProps {
  headline: React.ReactNode;
  highlightedText?: string;
  subtitle?: string;
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
  /** Single-line disclaimer text (ignored if disclaimerItems is set). */
  disclaimer?: string;
  /** Bullet items shown with tick icons (e.g. "No credit card required", "14-day free trial"). */
  disclaimerItems?: string[];
  className?: string;
}

const HERO_ICON_BG = '/images/brand/hero-icon-bg.png';

export function LandingHero({
  headline,
  highlightedText,
  subtitle,
  primaryCta,
  secondaryCta,
  primaryCtaShowArrow = true,
  disclaimer,
  disclaimerItems,
  className,
}: LandingHeroProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden bg-white px-4 py-20 dark:bg-[#0D1421] lg:px-8 lg:py-32',
        className,
      )}
    >
      {/* Dark mode: large icon above gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hidden dark:block">
          <div className="absolute -right-32 -top-20 opacity-30 lg:opacity-40">
            <Image
              src={HERO_ICON_BG}
              alt=""
              width={640}
              height={640}
              className="h-[480px] w-[480px] object-contain lg:h-[640px] lg:w-[640px]"
              aria-hidden
            />
          </div>
          {/* Gradient layer above dark blue, below icon */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#57C87F]/20 via-transparent to-emerald-500/15" />
          <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#57C87F]/25 blur-[100px]" />
          <div className="absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-[80px]" />
          <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-teal-500/15 blur-[80px]" />
        </div>
      </div>

      <div className="container relative z-10 mx-auto">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-[#3D4E5D] dark:text-white lg:text-6xl">
            {typeof headline === 'string' && highlightedText ? (
              <>
                {headline.split(highlightedText).map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span className="text-[#57C87F]">{highlightedText}</span>
                    )}
                  </React.Fragment>
                ))}
              </>
            ) : (
              headline
            )}
          </h1>

          {subtitle && (
            <p className="mb-10 text-lg text-gray-700 dark:text-gray-300 lg:text-xl">
              {subtitle}
            </p>
          )}

          {(primaryCta || secondaryCta) && (
            <div className="mb-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {primaryCta && (
                <Button
                  asChild
                  className="h-12 rounded-lg border-0 bg-[#57C87F] px-8 text-base font-semibold text-white hover:bg-[#4ab86f] dark:bg-[#57C87F] dark:hover:bg-[#4ab86f]"
                >
                  <Link href={primaryCta.href}>
                    {primaryCta.label}
                    {primaryCtaShowArrow && <ArrowRightIcon className="ml-2 h-4 w-4" />}
                  </Link>
                </Button>
              )}

              {secondaryCta && (
                <Button
                  asChild
                  variant="outline"
                  className="h-12 rounded-lg border-2 border-white bg-white px-8 text-base font-semibold text-[#0D1421] hover:bg-gray-100 dark:border-white dark:bg-white dark:text-[#0D1421] dark:hover:bg-gray-100"
                >
                  <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
                </Button>
              )}
            </div>
          )}

          {disclaimerItems && disclaimerItems.length > 0 ? (
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400 sm:gap-x-8">
              {disclaimerItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-[#57C87F]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : disclaimer ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {disclaimer}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
