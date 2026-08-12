'use client';

import type { ComponentProps } from 'react';
import { useMemo, useState } from 'react';

import Link from 'next/link';

import { SignUpMethodsContainer } from '@kit/auth/sign-up';
import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  type SignupContext,
  buildAuthLinkWithNext,
  buildCommercialSetupNext,
  buildCommercialSignupContext,
} from '~/lib/auth/signup-context-commercial';
import {
  clampBillableSeats,
  estimateMonthlyGbp,
  freeSupportSeats,
  illustrativeTierForSeats,
} from '~/lib/billing/commercial-graduated-pricing';
import { formatGbp } from '~/lib/billing/pricing-marketing';
import { marketingBtnGradient } from '~/lib/marketing/marketing-ui';

import { AuthSplitShell } from '../../_components/auth-split-shell';
import { SignupContextPanel } from './signup-context-panel';

type CommercialSignUpFlowProps = {
  initialContext: SignupContext;
  captchaSiteKey: string | undefined;
  displayTermsCheckbox: boolean;
  providers: ComponentProps<typeof SignUpMethodsContainer>['providers'];
};

export function CommercialSignUpFlow({
  initialContext,
  captchaSiteKey,
  displayTermsCheckbox,
  providers,
}: CommercialSignUpFlowProps) {
  const initialSeats = clampBillableSeats(initialContext.intent?.seats ?? 4);
  const [step, setStep] = useState<'plan' | 'account'>('plan');
  const [seats, setSeats] = useState(initialSeats);

  const context = useMemo(
    () =>
      buildCommercialSignupContext(
        initialContext.intent ?? {
          profile: 'commercial_property',
          interval: 'month',
          seats: initialSeats,
        },
        seats,
      ),
    [initialContext.intent, initialSeats, seats],
  );

  const nextPath = buildCommercialSetupNext(seats);
  const paths = {
    callback: pathsConfig.auth.callback,
    appHome: nextPath,
  };
  const signInHref = buildAuthLinkWithNext(
    pathsConfig.auth.signIn,
    nextPath,
  );

  const billable = clampBillableSeats(seats);
  const monthly = estimateMonthlyGbp(billable);
  const support = freeSupportSeats(billable);
  const tier = illustrativeTierForSeats(billable);

  return (
    <AuthSplitShell
      brandEyebrow={context.brandEyebrow}
      brandHeadline={context.brandHeadline}
      brandFooter={<SignupContextPanel context={context} />}
      formTitle={
        step === 'plan' ? 'Confirm your plan' : context.formTitle
      }
      formSubtitle={
        step === 'plan'
          ? 'Seats carry through from the pricing calculator — adjust if you need to, then create your account.'
          : context.formSubtitle
      }
    >
      {step === 'plan' ? (
        <div className="space-y-6" data-test="commercial-signup-plan-step">
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                { id: 'solo', seats: 1, label: 'Solo' },
                { id: 'team', seats: 4, label: 'Team' },
                { id: 'scale', seats: 10, label: 'Scale' },
              ] as const
            ).map((option) => {
              const active = tier.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSeats(option.seats)}
                  className={cn(
                    'rounded-xl border px-3 py-3 text-left transition',
                    active
                      ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                      : 'border-[color:var(--workspace-shell-border)] hover:border-[var(--ozer-accent)]/40',
                  )}
                >
                  <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                    {option.label}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                    {option.seats === 1
                      ? '1 seat'
                      : option.seats === 4
                        ? '2–7 seats'
                        : '8+ seats'}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="commercial-signup-seats">Billable seats</Label>
            <div className="flex items-center gap-3">
              <input
                id="commercial-signup-seats-range"
                type="range"
                min={1}
                max={30}
                value={billable}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--ozer-plum-alpha-08)] accent-[var(--ozer-coral-500)]"
                onChange={(event) =>
                  setSeats(clampBillableSeats(Number(event.target.value)))
                }
              />
              <Input
                id="commercial-signup-seats"
                type="number"
                min={1}
                max={30}
                value={billable}
                className="w-20"
                onChange={(event) =>
                  setSeats(
                    Math.min(
                      30,
                      clampBillableSeats(Number(event.target.value) || 1),
                    ),
                  )
                }
              />
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-cream-50)] p-4">
            <p className="text-xs tracking-[0.08em] text-[var(--workspace-shell-text-muted)] uppercase">
              {tier.label} · estimated monthly
            </p>
            <p className="mt-1 text-3xl font-bold text-[var(--workspace-shell-text)]">
              {formatGbp(monthly)}
              <span className="text-sm font-normal text-[var(--workspace-shell-text-muted)]">
                /mo
              </span>
            </p>
            <p className="mt-2 text-sm text-[var(--workspace-shell-text-muted)]">
              {support > 0
                ? `${support} free support seats included · 14-day trial`
                : 'Portal publishing included · 14-day trial'}
            </p>
          </div>

          <Button
            type="button"
            size="lg"
            className={cn(marketingBtnGradient, 'w-full')}
            onClick={() => setStep('account')}
          >
            Continue to create account
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="text-left text-sm text-[var(--workspace-shell-text-muted)] underline-offset-2 hover:text-[var(--workspace-shell-text)] hover:underline"
            onClick={() => setStep('plan')}
          >
            ← {tier.label} · {billable} seat{billable === 1 ? '' : 's'} ·{' '}
            {formatGbp(monthly)}/mo
          </button>

          <SignUpMethodsContainer
            providers={providers}
            displayTermsCheckbox={displayTermsCheckbox}
            paths={paths}
            captchaSiteKey={captchaSiteKey}
          />
        </>
      )}

      <p className="text-center text-sm text-[var(--workspace-shell-text-muted)]">
        <Trans i18nKey={'auth:alreadyHaveAnAccount'} />{' '}
        <Link
          href={signInHref}
          prefetch={true}
          className="font-semibold text-[var(--ozer-accent)] hover:text-[var(--ozer-accent-hover)]"
        >
          Sign in
        </Link>
      </p>
    </AuthSplitShell>
  );
}
