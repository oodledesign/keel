import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { COMMERCIAL_HOME_FINAL_CTA } from '~/lib/marketing/commercial-home-content';
import {
  marketingBtnPrimary,
  marketingDisplay,
  marketingLede,
  marketingSectionDark,
  marketingSectionDarkMuted,
} from '~/lib/marketing/marketing-ui';
import type { MarketingViewerContext } from '~/lib/marketing/marketing-viewer';

import { MarketingSectionIndex } from '../marketing-section-index';
import { WaitlistEmailForm } from './waitlist-email-form';

export function CommercialFinalCta({
  viewer,
}: {
  viewer: MarketingViewerContext;
}) {
  const copy = COMMERCIAL_HOME_FINAL_CTA;

  return (
    <section
      id="waitlist"
      className={cn('scroll-mt-20', marketingSectionDark)}
      aria-labelledby="home-final-cta-heading"
    >
      <div className="mx-auto w-full max-w-[88rem] px-6 py-20 md:py-28">
        <MarketingSectionIndex index="06" label="Waiting list" tone="dark" />

        <h2
          id="home-final-cta-heading"
          className={cn(
            marketingDisplay,
            'mt-12 max-w-[14ch] text-[var(--ozer-text-on-dark)] md:mt-16',
          )}
        >
          {viewer.isAuthenticated ? copy.signedInTitle : copy.title}
        </h2>

        <div className="mt-10 grid gap-8 md:mt-14 lg:grid-cols-12 lg:gap-10">
          <p
            className={cn(
              marketingLede,
              marketingSectionDarkMuted,
              'lg:col-span-5',
            )}
          >
            {viewer.isAuthenticated ? copy.signedInSubtitle : copy.subtitle}
          </p>

          <div className="lg:col-span-6 lg:col-start-7">
            {viewer.isAuthenticated ? (
              <Button asChild size="lg" className={marketingBtnPrimary}>
                <Link href={viewer.dashboardHref}>
                  Open your workspace
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <WaitlistEmailForm
                id="home-final-waitlist-email"
                source="home-final"
                tone="dark"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
