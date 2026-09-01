import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { MARKETING_FREE_SIGNUP_URL } from '~/lib/billing/pricing-marketing';
import {
  marketingBtnGradient,
  marketingBtnOutline,
  marketingMutedText,
  marketingSectionHeading,
} from '~/lib/marketing/marketing-ui';

import { FeatureTour } from './feature-tour';

export function FeatureTourSection() {
  return (
    <section
      id="features"
      className="relative mx-auto w-full max-w-[88rem] px-6 py-16 md:py-24"
      aria-labelledby="feature-tour-heading"
    >
      <div className="mb-8 max-w-2xl md:mx-auto md:mb-10 md:text-center">
        <p className="mb-2 text-xs font-medium tracking-[0.14em] text-[var(--workspace-shell-text-muted)] uppercase">
          A closer look
        </p>
        <h2
          id="feature-tour-heading"
          className={cn(
            marketingSectionHeading,
            'text-[var(--workspace-shell-text)]',
          )}
        >
          What it feels like in the workspace.
        </h2>
        <p className={cn('mt-3 text-base leading-relaxed', marketingMutedText)}>
          Scroll through the studio — pipeline, invoices, portals, notes, and
          the iPhone app we are building next.
        </p>
      </div>

      <FeatureTour />

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button asChild className={marketingBtnGradient}>
          <Link href={MARKETING_FREE_SIGNUP_URL}>Start free</Link>
        </Button>
        <Button asChild variant="outline" className={marketingBtnOutline}>
          <Link href="/pricing">See pricing</Link>
        </Button>
      </div>
    </section>
  );
}
