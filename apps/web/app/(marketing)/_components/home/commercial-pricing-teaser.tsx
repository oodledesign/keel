import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { getCommercialHomePricing } from '~/lib/marketing/commercial-home-pricing';
import {
  marketingBtnPrimary,
  marketingFigure,
  marketingLede,
  marketingMutedText,
  marketingRule,
  marketingTextLink,
} from '~/lib/marketing/marketing-ui';

import { MarketingSectionIndex } from '../marketing-section-index';

export function CommercialPricingTeaser() {
  const pricing = getCommercialHomePricing();

  return (
    <section
      id="pricing"
      className="mx-auto w-full max-w-[88rem] scroll-mt-24 px-6 py-20 md:py-28"
      aria-labelledby="home-pricing-heading"
    >
      <MarketingSectionIndex index="03" label="Rate card" />

      <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <h2 id="home-pricing-heading" className="sr-only">
            Pricing from {pricing.fromLabel} a month for the first seat
          </h2>
          <p
            className="text-[0.8125rem] font-medium text-[var(--workspace-shell-text-muted)]"
            aria-hidden="true"
          >
            From
          </p>
          <p
            className={cn(
              marketingFigure,
              'text-[6rem] leading-[0.9] text-[var(--workspace-shell-text)] md:text-[8.5rem]',
            )}
            aria-hidden="true"
          >
            {pricing.fromLabel}
          </p>
          <p
            className="mt-3 text-[0.9375rem] text-[var(--workspace-shell-text-muted)]"
            aria-hidden="true"
          >
            a month for the first seat, less for each seat after. Portals
            included.
          </p>
          <p className={cn(marketingLede, marketingMutedText, 'mt-8')}>
            One graduated price for every desk, published here rather than
            behind a demo. Rightmove Commercial, EACH and Property Hive are in
            the price, not add-ons.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Button asChild className={marketingBtnPrimary}>
              <Link href="/commercial-property#pricing">
                Price your desk
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Link href="#waitlist" className={marketingTextLink}>
              Join the waiting list
            </Link>
          </div>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Price per seat by band</caption>
            <thead>
              <tr className="text-[0.8125rem] font-medium text-[var(--workspace-shell-text-muted)]">
                <th scope="col" className="pb-3 font-medium">
                  Seats
                </th>
                <th scope="col" className="pb-3 text-right font-medium">
                  Per seat, per month
                </th>
              </tr>
            </thead>
            <tbody>
              {pricing.bands.map((band) => (
                <tr key={band.label} className={cn(marketingRule, 'border-t')}>
                  <th
                    scope="row"
                    className="py-5 text-base font-normal text-[var(--workspace-shell-text)]"
                  >
                    {band.label}
                  </th>
                  <td
                    className={cn(
                      marketingFigure,
                      'py-5 text-right text-[2rem] leading-none text-[var(--workspace-shell-text)]',
                    )}
                  >
                    {band.unitLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p
            className={cn(
              marketingRule,
              'border-t pt-4 text-[0.8125rem] leading-relaxed text-[var(--workspace-shell-text-muted)]',
            )}
          >
            A {pricing.example.seats}-negotiator desk:{' '}
            {pricing.example.workedLabel}
            {pricing.example.supportSeats > 0
              ? `, plus ${pricing.example.supportSeats} free support seats for admin and finance.`
              : '.'}
          </p>
        </div>
      </div>
    </section>
  );
}
