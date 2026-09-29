import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { getCommercialHomePricing } from '~/lib/marketing/commercial-home-pricing';
import {
  marketingBtnGradient,
  marketingBtnOutline,
  marketingFeatureCard,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

export function CommercialPricingTeaser() {
  const pricing = getCommercialHomePricing();

  return (
    <section
      id="pricing"
      className="mx-auto w-full max-w-7xl px-6 py-16"
      aria-labelledby="home-pricing-heading"
    >
      <div
        className={cn(
          'grid gap-8 rounded-[1.75rem] border border-[color:var(--workspace-shell-border)] p-8 md:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center',
          marketingFeatureCard,
        )}
      >
        <div>
          <p
            className={cn(
              'text-xs font-medium tracking-[0.14em] uppercase',
              marketingMutedText,
            )}
          >
            Published pricing
          </p>
          <h2
            id="home-pricing-heading"
            className="font-heading mt-2 text-3xl font-semibold text-[var(--workspace-shell-text)] md:text-4xl"
          >
            From {pricing.fromLabel} a month. Portals included.
          </h2>
          <p
            className={cn('mt-3 max-w-xl leading-relaxed', marketingMutedText)}
          >
            One graduated price for every desk — no demo to hear the number, no
            per-portal add-ons. A typical {pricing.example.seats}-negotiator
            desk is {pricing.example.totalLabel} a month
            {pricing.example.supportSeats > 0
              ? `, with ${pricing.example.supportSeats} free support seats for admin and finance`
              : ''}
            .
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className={marketingBtnGradient}>
              <Link href="/commercial-property#pricing">Price your desk</Link>
            </Button>
            <Button asChild variant="outline" className={marketingBtnOutline}>
              <Link href="#waitlist">Join the waiting list</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] p-5">
          <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
            {pricing.bands.map((band) => (
              <li
                key={band.label}
                className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-sm text-[var(--workspace-shell-text)]">
                  {band.label}
                </span>
                <span className="font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
                  {band.unitLabel}
                  <span
                    className={cn(
                      'ml-1 text-xs font-normal',
                      marketingMutedText,
                    )}
                  >
                    / seat / mo
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className={cn('mt-4 text-xs', marketingMutedText)}>
            {pricing.example.workedLabel}
          </p>
        </div>
      </div>
    </section>
  );
}
