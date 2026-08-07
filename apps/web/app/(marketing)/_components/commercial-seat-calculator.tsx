'use client';

import { useState } from 'react';

import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';

import {
  COMMERCIAL_GRADUATED_PLAN_ID,
  COMMERCIAL_GRADUATED_PRODUCT_ID,
  clampBillableSeats,
  estimateMonthlyGbp,
  freeSupportSeats,
  illustrativeTierForSeats,
  portalPublishingAllowed,
} from '~/lib/billing/commercial-graduated-pricing';
import {
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import {
  marketingBodyText,
  marketingBtnGradient,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

export function CommercialSeatCalculator() {
  const [seats, setSeats] = useState(4);
  const billable = clampBillableSeats(seats);
  const monthly = estimateMonthlyGbp(billable);
  const support = freeSupportSeats(billable);
  const portals = portalPublishingAllowed(billable);
  const tier = illustrativeTierForSeats(billable);
  const signupUrl = buildPricingSignupUrl({
    profile: 'commercial_property',
    productId: COMMERCIAL_GRADUATED_PRODUCT_ID,
    planId: COMMERCIAL_GRADUATED_PLAN_ID,
    seats: billable,
  });

  return (
    <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 md:p-8">
      <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4">
          <h3 className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]">
            Seat calculator
          </h3>
          <p className={`text-sm ${marketingBodyText}`}>
            Transparent graduated pricing — the same Stripe Price for every
            agency. Seat 1 is £89, seats 2–7 are £55, seats 8+ are £39. No quote
            form.
          </p>

          <div className="space-y-2">
            <Label htmlFor="commercial-seat-calc">Billable seats</Label>
            <Input
              id="commercial-seat-calc"
              type="range"
              min={1}
              max={30}
              value={billable}
              onChange={(event) =>
                setSeats(clampBillableSeats(Number(event.target.value)))
              }
            />
            <div className="flex items-center justify-between gap-3">
              <Input
                type="number"
                min={1}
                max={200}
                value={billable}
                onChange={(event) =>
                  setSeats(clampBillableSeats(Number(event.target.value) || 1))
                }
                className="w-24"
              />
              <p className={`text-sm ${marketingMutedText}`}>
                Maps to {tier.label}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 p-5">
          <p className="text-sm tracking-[0.08em] uppercase text-[var(--workspace-shell-text-muted)]">
            Estimated monthly total
          </p>
          <p className="text-4xl font-bold tracking-tight text-[var(--workspace-shell-text)]">
            {formatGbp(monthly)}
            <span className={`text-base font-normal ${marketingMutedText}`}>
              /mo
            </span>
          </p>
          <ul className={`space-y-2 text-sm ${marketingBodyText}`}>
            <li>
              {support > 0
                ? `${support} free support seats included`
                : 'No free support seats on Solo (1 billable)'}
            </li>
            <li>
              {portals
                ? 'Portal publishing (Rightmove / EG) included'
                : 'Portal publishing from 2 billable seats'}
            </li>
            <li>14-day trial · cancel anytime</li>
          </ul>
          <Button asChild size="lg" className={marketingBtnGradient}>
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
