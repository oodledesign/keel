import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { COMMERCIAL_HOME_FINAL_CTA } from '~/lib/marketing/commercial-home-content';
import {
  marketingBtnGradient,
  marketingSectionDark,
  marketingSectionDarkMuted,
} from '~/lib/marketing/marketing-ui';
import type { MarketingViewerContext } from '~/lib/marketing/marketing-viewer';

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
      className="scroll-mt-24 px-6 py-10 md:py-14"
      aria-labelledby="home-final-cta-heading"
    >
      <div
        className={cn(
          'relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-[color:var(--ozer-border-on-dark)] px-6 py-14 md:rounded-[2.5rem] md:px-12 md:py-20',
          marketingSectionDark,
        )}
      >
        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2
            id="home-final-cta-heading"
            className="font-heading text-3xl leading-tight font-bold text-[var(--ozer-text-on-dark)] md:text-4xl lg:text-[2.75rem]"
          >
            {viewer.isAuthenticated ? copy.signedInTitle : copy.title}
          </h2>
          <p
            className={cn(
              'mx-auto mt-4 max-w-xl text-base leading-relaxed md:text-lg',
              marketingSectionDarkMuted,
            )}
          >
            {viewer.isAuthenticated ? copy.signedInSubtitle : copy.subtitle}
          </p>

          <div className="mt-8 flex w-full justify-center">
            {viewer.isAuthenticated ? (
              <Button asChild size="lg" className={marketingBtnGradient}>
                <Link href={viewer.dashboardHref}>
                  Open your workspace
                  <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <WaitlistEmailForm
                id="home-final-waitlist-email"
                source="home-final"
                tone="dark"
                className="w-full justify-center"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
