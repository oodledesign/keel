import Image from 'next/image';
import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

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

  return (
    <section
      className="marketing-section-plum marketing-section-plum-hero border-b-0"
      aria-labelledby="home-hero-heading"
    >
      <div className="mx-auto w-full max-w-[88rem] px-6 pt-10 md:pt-14">
        <MarketingSectionIndex
          tone="dark"
          label={hero.eyebrow}
          aside={hero.status}
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
            {hero.subtitle}
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
                <Link
                  href="/commercial-property#pricing"
                  className={marketingTextLinkOnDark}
                >
                  See pricing
                </Link>
              </div>
            ) : (
              <>
                <WaitlistEmailForm
                  id="home-hero-waitlist-email"
                  source="home-hero"
                  tone="dark"
                  label={hero.formLabel}
                  placeholder={hero.formPlaceholder}
                  buttonLabel={hero.submitLabel}
                />
                <p className={cn('mt-4 text-sm', marketingSectionDarkMuted)}>
                  {hero.reassurance}{' '}
                  <Link
                    href="/commercial-property#pricing"
                    className={cn(marketingTextLinkOnDark, 'text-sm')}
                  >
                    See pricing
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>

        <div
          className={cn(
            'mt-14 flex flex-col gap-5 border-t pt-5 sm:flex-row sm:items-center sm:gap-10 md:mt-20',
            marketingRuleOnDark,
          )}
        >
          <p
            className={cn(
              'shrink-0 text-[0.8125rem] font-medium',
              marketingSectionDarkMuted,
            )}
          >
            {hero.portalsLabel}
          </p>
          <ul
            className="flex flex-wrap items-center gap-x-10 gap-y-4"
            aria-label="Portals"
          >
            {COMMERCIAL_HOME_PUBLISH_PORTALS.map((portal) => (
              <li key={portal.name}>
                <Image
                  src={portal.logoSrc}
                  alt={portal.name}
                  width={160}
                  height={40}
                  unoptimized
                  className="h-7 w-auto max-w-[9rem] object-contain opacity-90 md:h-8"
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 grid gap-8 md:mt-16 lg:grid-cols-12 lg:gap-10">
          <MarketingScreenCaptions
            screen={COMMERCIAL_HOME_HERO_SCREEN}
            tone="dark"
            className="gap-y-4 self-start sm:grid-cols-3 lg:col-span-3 lg:grid-cols-1 lg:pt-2"
          />
          <MarketingScreen
            screen={COMMERCIAL_HOME_HERO_SCREEN}
            tone="dark"
            priority
            hideCaptions
            sizes="(min-width: 1024px) 75vw, 100vw"
            className="lg:col-span-9 lg:mr-[calc(-1*(max(0px,(100vw_-_88rem)/2)_+_1.5rem))]"
            frameClassName="rounded-b-none border-b-0 lg:rounded-r-none lg:border-r-0"
          />
        </div>
      </div>
    </section>
  );
}
