'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';

import {
  COMMERCIAL_GRADUATED_PLAN_ID,
  COMMERCIAL_GRADUATED_PRODUCT_ID,
  clampBillableSeats,
  estimateMonthlyBreakdownGbp,
  freeSupportSeats,
  illustrativeTierForSeats,
} from '~/lib/billing/commercial-graduated-pricing';
import {
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import { marketingBtnGradient } from '~/lib/marketing/marketing-ui';

type CommercialSeatCalculatorProps = {
  className?: string;
};

const fieldClassName =
  'border-[color:var(--ozer-border-on-dark-strong)] bg-[var(--ozer-on-dark-alpha-08)] text-[var(--ozer-text-on-dark)] placeholder:text-[var(--ozer-text-on-dark-muted)] focus-visible:border-[var(--ozer-coral-500)]/50 focus-visible:ring-[var(--ozer-coral-500)]/30';

export function CommercialSeatCalculator({
  className,
}: CommercialSeatCalculatorProps) {
  const [seats, setSeats] = useState(4);
  const billable = clampBillableSeats(seats);
  const { lines, totalGbp } = estimateMonthlyBreakdownGbp(billable);
  const support = freeSupportSeats(billable);
  const tier = illustrativeTierForSeats(billable);
  const signupUrl = buildPricingSignupUrl({
    profile: 'commercial_property',
    productId: COMMERCIAL_GRADUATED_PRODUCT_ID,
    planId: COMMERCIAL_GRADUATED_PLAN_ID,
    seats: billable,
  });

  return (
    <div
      id="your-plan"
      className={cn(
        'scroll-mt-24 rounded-2xl border border-[color:var(--ozer-border-on-dark-strong)] bg-[var(--ozer-plum-950)] p-6 text-[var(--ozer-text-on-dark)] md:p-8',
        className,
      )}
    >
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <div className="space-y-5">
          <div className="space-y-2">
            <h3 className="font-heading text-xl font-semibold text-[var(--ozer-text-on-dark)] md:text-2xl">
              Your Plan
            </h3>
            <p className="text-sm text-[var(--ozer-text-on-dark-muted)]">
              Transparent graduated pricing — the same price for every agency.
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="commercial-seat-calc"
              className="text-[var(--ozer-text-on-dark-muted)]"
            >
              Billable seats
            </Label>
            <input
              id="commercial-seat-calc"
              type="range"
              min={1}
              max={30}
              value={billable}
              aria-valuetext={`${billable} billable seat${billable === 1 ? '' : 's'} — ${tier.label}`}
              autoComplete="off"
              data-form-type="other"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore="true"
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--ozer-on-dark-alpha-08)] accent-[var(--ozer-coral-500)]"
              onChange={(event) =>
                setSeats(clampBillableSeats(Number(event.target.value)))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Input
              id="commercial-seat-count"
              name="commercial-billable-seats"
              aria-label="Number of billable seats"
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              value={billable}
              autoComplete="off"
              data-form-type="other"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore="true"
              suppressHydrationWarning
              onChange={(event) =>
                setSeats(
                  Math.min(
                    30,
                    clampBillableSeats(Number(event.target.value) || 1),
                  ),
                )
              }
              className={cn('w-24', fieldClassName)}
            />
            <p className="text-sm text-[var(--ozer-text-on-dark-muted)]">
              Maps to {tier.label}
            </p>
          </div>
        </div>

        <div className="flex flex-col space-y-4 rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] p-5 text-[var(--ozer-plum-950)]">
          <p className="text-sm tracking-[0.08em] text-[var(--ozer-plum-600)] uppercase">
            Estimated monthly total
          </p>

          <dl
            className="space-y-2 text-sm text-[var(--ozer-plum-700)]"
            aria-live="polite"
            aria-atomic="true"
          >
            {lines.map((line) => (
              <div
                key={line.bandLabel}
                className="flex items-baseline justify-between gap-4"
              >
                <dt>
                  {line.bandLabel}{' '}
                  <span className="text-[var(--ozer-plum-600)]">
                    ({line.seatsInBand} × {formatGbp(line.unitGbp)})
                  </span>
                </dt>
                <dd className="shrink-0 font-medium tabular-nums text-[var(--ozer-plum-950)]">
                  {formatGbp(line.subtotalGbp)}
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 border-t border-[color:var(--workspace-shell-border)] pt-3">
              <dt className="font-semibold text-[var(--ozer-plum-950)]">
                Estimated monthly total
              </dt>
              <dd className="text-2xl font-bold tracking-tight tabular-nums text-[var(--ozer-plum-950)]">
                {formatGbp(totalGbp)}
                <span className="text-base font-normal text-[var(--ozer-plum-600)]">
                  /mo
                </span>
              </dd>
            </div>
          </dl>

          <ul className="space-y-2 text-sm text-[var(--ozer-plum-700)]">
            <li>
              {support > 0
                ? `${support} free support seats included`
                : 'No free support seats on Solo (1 billable)'}
            </li>
            <li>Portal publishing included</li>
          </ul>
          <Button
            asChild
            size="lg"
            className={cn(marketingBtnGradient, 'mt-auto w-full')}
          >
            <Link href={signupUrl}>
              Start with {billable} seat{billable === 1 ? '' : 's'}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
