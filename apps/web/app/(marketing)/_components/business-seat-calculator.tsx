'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';

import {
  BUSINESS_GRADUATED_PLAN_ID,
  BUSINESS_GRADUATED_PRODUCT_ID,
  aiCreditsForBillableSeats,
  clampBillableSeats,
  estimateMonthlyBreakdownGbp,
  illustrativeTierForSeats,
  maxProjectGuestsForBillableSeats,
} from '~/lib/billing/business-graduated-pricing';
import {
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import { marketingBtnGradient } from '~/lib/marketing/marketing-ui';

type BusinessSeatCalculatorProps = {
  className?: string;
  /** Dark marketing panel (segment landing) vs light (/pricing). */
  variant?: 'dark' | 'light';
};

export function BusinessSeatCalculator({
  className,
  variant = 'dark',
}: BusinessSeatCalculatorProps) {
  const [seats, setSeats] = useState(4);
  const billable = clampBillableSeats(seats);
  const { lines, totalGbp } = estimateMonthlyBreakdownGbp(billable);
  const tier = illustrativeTierForSeats(billable);
  const aiCredits = aiCreditsForBillableSeats(billable);
  const projectGuests = maxProjectGuestsForBillableSeats(billable);
  const signupUrl = buildPricingSignupUrl({
    profile: 'work_design',
    productId: BUSINESS_GRADUATED_PRODUCT_ID,
    planId: BUSINESS_GRADUATED_PLAN_ID,
    seats: billable,
  });

  const isDark = variant === 'dark';

  const fieldClassName = isDark
    ? 'border-[color:var(--ozer-border-on-dark-strong)] bg-[var(--ozer-on-dark-alpha-08)] text-[var(--ozer-text-on-dark)] placeholder:text-[var(--ozer-text-on-dark-muted)] focus-visible:border-[var(--ozer-coral-500)]/50 focus-visible:ring-[var(--ozer-coral-500)]/30'
    : '';

  return (
    <div
      id="business-your-plan"
      className={cn(
        'scroll-mt-24 rounded-2xl border p-6 md:p-8',
        isDark
          ? 'border-[color:var(--ozer-border-on-dark-strong)] bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]'
          : 'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-950)]',
        className,
      )}
    >
      <div className="grid gap-6 md:grid-cols-2 md:items-start md:gap-14 lg:gap-20">
        <div className="space-y-5">
          <div className="space-y-2">
            <h3
              className={cn(
                'font-heading text-xl font-semibold md:text-2xl',
                isDark
                  ? 'text-[var(--ozer-text-on-dark)]'
                  : 'text-[var(--ozer-plum-950)]',
              )}
            >
              Your Plan
            </h3>
            <p
              className={cn(
                'text-sm',
                isDark
                  ? 'text-[var(--ozer-text-on-dark-muted)]'
                  : 'text-[var(--ozer-plum-600)]',
              )}
            >
              Graduated per-seat pricing — seat 1 at £29, then cheaper add-on
              seats. Shared AI and project guests scale with your team.
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="business-seat-calc"
              className={
                isDark
                  ? 'text-[var(--ozer-text-on-dark-muted)]'
                  : 'text-[var(--ozer-plum-700)]'
              }
            >
              Billable seats
            </Label>
            <input
              id="business-seat-calc"
              type="range"
              min={1}
              max={30}
              value={billable}
              aria-valuetext={`${billable} billable seat${billable === 1 ? '' : 's'} — ${tier.label}`}
              autoComplete="off"
              className={cn(
                'h-2 w-full cursor-pointer appearance-none rounded-full accent-[var(--ozer-coral-500)]',
                isDark
                  ? 'bg-[var(--ozer-on-dark-alpha-08)]'
                  : 'bg-[var(--ozer-plum-100)]',
              )}
              onChange={(event) =>
                setSeats(clampBillableSeats(Number(event.target.value)))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Input
              id="business-seat-count"
              name="business-billable-seats"
              aria-label="Number of billable seats"
              type="number"
              inputMode="numeric"
              min={1}
              max={30}
              value={billable}
              autoComplete="off"
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
            <p
              className={cn(
                'text-sm',
                isDark
                  ? 'text-[var(--ozer-text-on-dark-muted)]'
                  : 'text-[var(--ozer-plum-600)]',
              )}
            >
              Maps to {tier.label}
            </p>
          </div>
        </div>

        <div
          className={cn(
            'flex flex-col space-y-4 rounded-xl border p-5',
            isDark
              ? 'border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-950)]'
              : 'border-[color:var(--workspace-shell-border)] bg-white text-[var(--ozer-plum-950)]',
          )}
        >
          <p className="text-sm font-bold tracking-[0.08em] text-[var(--ozer-plum-600)] uppercase">
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
                <dd className="shrink-0 font-medium text-[var(--ozer-plum-950)] tabular-nums">
                  {formatGbp(line.subtotalGbp)}
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 border-t border-[color:var(--workspace-shell-border)] pt-3">
              <dt className="font-bold text-[var(--ozer-plum-950)]">
                Estimated monthly total
              </dt>
              <dd className="text-2xl font-bold tracking-tight text-[var(--ozer-plum-950)] tabular-nums">
                {formatGbp(totalGbp)}
                <span className="text-base font-normal text-[var(--ozer-plum-600)]">
                  /mo
                </span>
              </dd>
            </div>
          </dl>

          <ul className="space-y-2 text-sm text-[var(--ozer-plum-700)]">
            <li>{aiCredits.toLocaleString()} shared AI credits / month</li>
            <li>
              {projectGuests} project guest
              {projectGuests === 1 ? '' : 's'} included
            </li>
            <li>Unlimited client portal access</li>
            <li>Unlimited sharing with other paid workspaces</li>
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
