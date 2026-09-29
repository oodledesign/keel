import type { ReactNode } from 'react';

import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { MARKETING_FREE_SIGNUP_URL } from '~/lib/billing/pricing-marketing';
import type { FeatureTourBlock } from '~/lib/marketing/feature-tour-content';
import {
  marketingBtnPrimary,
  marketingTextLink,
} from '~/lib/marketing/marketing-ui';

import { FeatureTour } from './feature-tour';
import { MarketingSectionHeader } from './marketing-section-index';

type FeatureTourSectionProps = {
  id?: string;
  blocks?: FeatureTourBlock[];
  /** Section number shown in the index marker, e.g. "03". */
  index?: string;
  eyebrow?: string;
  heading?: string;
  intro?: string;
  /** Replaces the default Start free / See pricing buttons. */
  cta?: ReactNode;
};

export function FeatureTourSection({
  id = 'features',
  blocks,
  index,
  eyebrow = 'A closer look',
  heading = 'What it feels like in the workspace.',
  intro = 'Scroll through the studio: pipeline, invoices, client portals, notes, and the iPhone app we are building next.',
  cta,
}: FeatureTourSectionProps = {}) {
  return (
    <section
      id={id}
      className="relative mx-auto w-full max-w-[88rem] px-6 py-16 md:py-24"
      aria-labelledby="feature-tour-heading"
    >
      <MarketingSectionHeader
        index={index}
        label={eyebrow}
        title={heading}
        intro={intro}
        headingId="feature-tour-heading"
        className="mb-12 md:mb-16"
      />

      <FeatureTour blocks={blocks} />

      <div className="mt-12 flex flex-wrap items-center gap-6">
        {cta ?? (
          <>
            <Button asChild className={marketingBtnPrimary}>
              <Link href={MARKETING_FREE_SIGNUP_URL}>
                Start free
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Link href="/pricing" className={marketingTextLink}>
              See pricing
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
