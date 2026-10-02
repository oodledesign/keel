import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { commercialCta } from '~/config/commercial-cta.config';
import { COMMERCIAL_FINAL_CTA } from '~/lib/marketing/commercial-home-content';
import type { MarketingViewerContext } from '~/lib/marketing/marketing-viewer';

import { WaitlistEmailForm } from './waitlist-email-form';

export function CommercialFinalCta({
  viewer,
}: {
  viewer: MarketingViewerContext;
}) {
  const isWaitlist = commercialCta.mode === 'waitlist';

  return (
    <section
      id="waitlist"
      className="w-full bg-[#FF5C34] py-20 text-[#2A1720] md:py-28"
      aria-labelledby="home-final-cta-heading"
    >
      <div className="mx-auto w-full max-w-4xl px-6 text-center">
        <h2
          id="home-final-cta-heading"
          className="font-heading text-3xl font-semibold tracking-tight text-[#2A1720] sm:text-4xl lg:text-5xl"
        >
          {COMMERCIAL_FINAL_CTA.heading}
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-base font-semibold text-[#2A1720] sm:text-lg">
          {COMMERCIAL_FINAL_CTA.body}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4">
          {viewer.isAuthenticated ? (
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[#2A1720] px-6 text-[#FBF6EC] hover:bg-[#1E1017] hover:text-white"
              >
                <Link href={viewer.dashboardHref}>
                  Open your workspace
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          ) : isWaitlist ? (
            <div className="w-full max-w-md">
              <WaitlistEmailForm
                id="home-final-waitlist-email"
                source="home-final"
                tone="orange-topaze"
                buttonLabel={commercialCta.primaryLabel}
              />
              <div className="mt-4 text-center">
                <Link
                  href="/auth/sign-in"
                  className="text-xs font-semibold text-[#2A1720] underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[#2A1720] px-6 text-[#FBF6EC] hover:bg-[#1E1017] hover:text-white"
              >
                <Link href={commercialCta.primaryHref}>
                  {commercialCta.primaryLabel}
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Link
                href="/auth/sign-in"
                className="text-sm font-semibold text-[#2A1720] underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
