import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { COMMERCIAL_HOME_HERO } from '~/lib/marketing/commercial-home-content';
import {
  marketingBtnGradient,
  marketingBtnOutlineOnDark,
  marketingEyebrowOnDark,
  marketingHeadlineGradient,
  marketingSectionDarkMuted,
} from '~/lib/marketing/marketing-ui';
import type { MarketingViewerContext } from '~/lib/marketing/marketing-viewer';

import { PublishToPortalsMock } from './publish-to-portals-mock';
import { WaitlistEmailForm } from './waitlist-email-form';

const PRESS_CLASS =
  'transition-transform duration-150 ease-out active:scale-[0.97]';

export function CommercialHomeHero({
  viewer,
}: {
  viewer: MarketingViewerContext;
}) {
  const hero = COMMERCIAL_HOME_HERO;

  return (
    <section
      className="marketing-section-plum marketing-section-plum-hero -mb-4"
      aria-labelledby="home-hero-heading"
    >
      <div className="relative mx-auto w-full max-w-7xl px-6 pt-24 pb-16 md:pt-28 md:pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="flex flex-col gap-7">
            <span className={marketingEyebrowOnDark}>{hero.eyebrow}</span>
            <div className="space-y-4">
              <h1
                id="home-hero-heading"
                className="font-heading text-4xl leading-[1.08] font-bold tracking-tight text-[var(--ozer-text-on-dark)] md:text-5xl lg:text-6xl"
              >
                {hero.title}
                <span className={cn(marketingHeadlineGradient, 'mt-1 block')}>
                  {hero.titleAccent}.
                </span>
              </h1>
              <p
                className={cn(
                  'max-w-xl text-base leading-relaxed md:text-lg',
                  marketingSectionDarkMuted,
                )}
              >
                {hero.subtitle}
              </p>
            </div>

            {viewer.isAuthenticated ? (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  asChild
                  size="lg"
                  className={cn(marketingBtnGradient, PRESS_CLASS)}
                >
                  <Link href={viewer.dashboardHref}>
                    {hero.signedInLabel}
                    <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className={cn(marketingBtnOutlineOnDark, PRESS_CLASS)}
                >
                  <Link href="/commercial-property#pricing">See pricing</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <WaitlistEmailForm
                  id="home-hero-waitlist-email"
                  source="home-hero"
                  tone="dark"
                  label={hero.formLabel}
                  placeholder={hero.formPlaceholder}
                  buttonLabel={hero.submitLabel}
                />
                <p className={cn('text-sm', marketingSectionDarkMuted)}>
                  {hero.reassurance}{' '}
                  <Link
                    href="/commercial-property#pricing"
                    className="font-medium text-[var(--ozer-text-on-dark)] underline decoration-[var(--ozer-accent)]/60 underline-offset-4 hover:decoration-[var(--ozer-accent)]"
                  >
                    See pricing
                  </Link>
                </p>
              </div>
            )}
          </div>

          <PublishToPortalsMock />
        </div>
      </div>
    </section>
  );
}
