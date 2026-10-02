import Image from 'next/image';
import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { commercialCta } from '~/config/commercial-cta.config';
import {
  COMMERCIAL_HOME_HERO,
  COMMERCIAL_HOME_HERO_SCREEN,
  COMMERCIAL_HOME_PUBLISH_PORTALS,
} from '~/lib/marketing/commercial-home-content';
import {
  marketingBtnPrimary,
  marketingDisplay,
  marketingLede,
  marketingRuleOnDark,
  marketingSectionDarkMuted,
  marketingTextLinkOnDark,
} from '~/lib/marketing/marketing-ui';
import type { MarketingViewerContext } from '~/lib/marketing/marketing-viewer';

import { MarketingScreen, MarketingScreenCaptions } from '../marketing-screen';
import { MarketingSectionIndex } from '../marketing-section-index';
import { WaitlistEmailForm } from './waitlist-email-form';

export function CommercialHomeHero({
  viewer,
}: {
  viewer: MarketingViewerContext;
}) {
  const hero = COMMERCIAL_HOME_HERO;
  const isWaitlist = commercialCta.mode === 'waitlist';

  return (
    <section
      className="marketing-section-plum marketing-section-plum-hero border-b-0"
      aria-labelledby="home-hero-heading"
    >
      <div className="mx-auto w-full max-w-[88rem] px-6 pt-10 md:pt-14">
        <MarketingSectionIndex
          tone="dark"
          label={hero.eyebrow}
          aside={commercialCta.heroBadge}
        />

        <h1
          id="home-hero-heading"
          className={cn(
            marketingDisplay,
            'mt-10 max-w-[16ch] text-[var(--ozer-text-on-dark)] md:mt-14',
          )}
        >
          {hero.title}
        </h1>

        <div className="mt-10 grid gap-8 md:mt-12 lg:grid-cols-12 lg:gap-10">
          <p
            className={cn(
              marketingLede,
              marketingSectionDarkMuted,
              'lg:col-span-5',
            )}
          >
            {hero.body}
          </p>

          <div className="lg:col-span-6 lg:col-start-7">
            {viewer.isAuthenticated ? (
              <div className="flex flex-wrap items-center gap-6">
                <Button asChild size="lg" className={marketingBtnPrimary}>
                  <Link href={viewer.dashboardHref}>
                    {hero.signedInLabel}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Link href="#pricing" className={marketingTextLinkOnDark}>
                  See pricing
                </Link>
              </div>
            ) : isWaitlist ? (
              <div>
                <WaitlistEmailForm
                  id="home-hero-waitlist-email"
                  source="home-hero"
                  tone="dark"
                  label={hero.formLabel}
                  placeholder={hero.formPlaceholder}
                  buttonLabel={commercialCta.primaryLabel}
                />
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <span className="text-xs font-medium text-[var(--ozer-cream-50)]/70">
                    {hero.microLine}
                  </span>
                  <Link
                    href="#pricing"
                    className={cn(marketingTextLinkOnDark, 'text-xs')}
                  >
                    See pricing
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center gap-4">
                  <Button asChild size="lg" className={marketingBtnPrimary}>
                    <Link href={commercialCta.primaryHref}>
                      {commercialCta.primaryLabel}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Link href="#pricing" className={marketingTextLinkOnDark}>
                    See pricing
                  </Link>
                </div>
                <p className="mt-3 text-xs font-medium text-[var(--ozer-cream-50)]/70">
                  {hero.microLine}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Publishes to logo strip directly under hero on dark background */}
        <div
          className={cn(
            'mt-14 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:gap-8 md:mt-16',
            marketingRuleOnDark,
          )}
        >
          <p
            className={cn(
              'shrink-0 text-xs font-semibold tracking-wider uppercase',
              marketingSectionDarkMuted,
            )}
          >
            {hero.portalsLabel}
          </p>

          <ul
            className="flex flex-wrap items-center gap-x-8 gap-y-3"
            aria-label="Supported property portals"
          >
            {COMMERCIAL_HOME_PUBLISH_PORTALS.map((portal) => (
              <li key={portal.name} className="flex items-center gap-2.5">
                <Image
                  src={portal.logoSrc}
                  alt=""
                  width={22}
                  height={22}
                  className="rounded object-contain brightness-95"
                  aria-hidden="true"
                />
                <span className="text-xs font-medium text-[var(--ozer-text-on-dark)]">
                  {portal.name}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Agency-home dashboard visual */}
        <div className="mt-12 md:mt-16">
          <MarketingScreen
            screen={COMMERCIAL_HOME_HERO_SCREEN}
            priority
            tone="dark"
          />
          <MarketingScreenCaptions
            screen={COMMERCIAL_HOME_HERO_SCREEN}
            tone="dark"
          />
        </div>
      </div>
    </section>
  );
}
