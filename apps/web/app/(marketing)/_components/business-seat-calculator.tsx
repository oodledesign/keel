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
  maxProjectGuestsForBillableSeats,
} from '~/lib/billing/business-graduated-pricing';
import {
  BUSINESS_STARTER_PLAN_ID,
  BUSINESS_STARTER_PRODUCT_ID,
  estimateStarterMonthlyBreakdownGbp,
  maxProjectGuestsForStarterBillableSeats,
} from '~/lib/billing/business-starter-pricing';
import {
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import { marketingBtnGradient } from '~/lib/marketing/marketing-ui';

type PaidPlan = 'starter' | 'pro';

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
  const [plan, setPlan] = useState<PaidPlan>('pro');
  const billable = clampBillableSeats(seats);
  const isStarter = plan === 'starter';
  const { lines, totalGbp } = isStarter
    ? estimateStarterMonthlyBreakdownGbp(billable)
    : estimateMonthlyBreakdownGbp(billable);
  const projectGuests = isStarter
    ? maxProjectGuestsForStarterBillableSeats(billable)
    : maxProjectGuestsForBillableSeats(billable);
  const aiCredits = isStarter ? null : aiCreditsForBillableSeats(billable);
  const signupUrl = buildPricingSignupUrl({
    profile: 'work_design',
    productId: isStarter
      ? BUSINESS_STARTER_PRODUCT_ID
      : BUSINESS_GRADUATED_PRODUCT_ID,
    planId: isStarter ? BUSINESS_STARTER_PLAN_ID : BUSINESS_GRADUATED_PLAN_ID,
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
              Compare Starter and Pro for the same seat count. Extra seats stay
              cheaper than seat 1. No transaction fees on your subscription.
            </p>
          </div>

          <div
            className="inline-flex rounded-full border border-[color:var(--workspace-shell-border)] p-1"
            role="group"
            aria-label="Paid plan"
          >
            <button
              type="button"
              onClick={() => setPlan('starter')}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition',
                isStarter
                  ? 'bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)]'
                  : isDark
                    ? 'text-[var(--ozer-text-on-dark-muted)]'
                    : 'text-[var(--ozer-plum-600)]',
              )}
            >
              Starter
            </button>
            <button
              type="button"
              onClick={() => setPlan('pro')}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition',
                !isStarter
                  ? 'bg-[var(--ozer-accent)] text-[var(--ozer-plum-950)]'
                  : isDark
                    ? 'text-[var(--ozer-text-on-dark-muted)]'
                    : 'text-[var(--ozer-plum-600)]',
              )}
            >
              Pro
            </button>
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
              aria-valuetext={`${billable} billable seat${billable === 1 ? '' : 's'} on ${isStarter ? 'Starter' : 'Pro'}`}
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
              {isStarter
                ? '£14 first seat, £9 each extra'
                : '£29 first seat, £22 each extra'}
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
            {isStarter ? 'Starter' : 'Pro'} estimated monthly total
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
            {aiCredits != null ? (
              <li>
                {aiCredits.toLocaleString()} shared AI credits / month — drafts,
                summaries, and coaching
              </li>
            ) : (
              <li>Shared AI credit pool — same workspace meter as Pro</li>
            )}
            <li>
              {projectGuests} project guest
              {projectGuests === 1 ? '' : 's'} included
            </li>
            <li>
              {isStarter
                ? '10 GB client portal storage'
                : '25 GB client portal storage'}
            </li>
            {!isStarter ? (
              <li>Unlimited sharing with other paid workspaces</li>
            ) : null}
          </ul>
          <Button
            asChild
            size="lg"
            className={cn(marketingBtnGradient, 'mt-auto w-full')}
          >
            <Link href={signupUrl}>
              Start {isStarter ? 'Starter' : 'Pro'} with {billable} seat
              {billable === 1 ? '' : 's'}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
