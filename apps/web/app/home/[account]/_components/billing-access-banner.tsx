'use client';

import Link from 'next/link';

import { AlertTriangle, CreditCard } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { UpdatePaymentMethodButton } from './update-payment-method-button';

import type { AccountAccessLevel } from '~/lib/billing/account-access-matrix';
import type { AccountBillingStatus } from '~/lib/billing/account-billing-types';

export type BillingAccessBannerProps = {
  accountId: string;
  accountSlug: string;
  billingPath: string;
  level: Exclude<AccountAccessLevel, 'full_access'>;
  status: AccountBillingStatus | null;
  /** When false, show link to billing instead of portal form (no Stripe customer yet). */
  hasStripeCustomer: boolean;
};

function copyFor(
  level: BillingAccessBannerProps['level'],
  status: AccountBillingStatus | null,
): { title: string; body: string; tone: 'warning' | 'danger' } {
  if (level === 'restricted_access') {
    return {
      tone: 'warning',
      title: 'Workspace restricted',
      body: 'Payment is overdue. You can still view existing work, but creating and editing is limited until billing is updated. Public booking pages stay live for your clients.',
    };
  }

  switch (status) {
    case 'trial_expired':
      return {
        tone: 'danger',
        title: 'Trial ended',
        body: 'Your trial has finished. Update billing to restore full access to this workspace. Your data is kept.',
      };
    case 'suspended':
      return {
        tone: 'danger',
        title: 'Account suspended',
        body: 'Access is blocked because we could not collect payment. Update your payment method to reactivate. Your data is retained.',
      };
    case 'canceled':
      return {
        tone: 'danger',
        title: 'Subscription cancelled',
        body: 'This workspace subscription is cancelled. Resubscribe from billing to regain access.',
      };
    default:
      return {
        tone: 'danger',
        title: 'Billing required',
        body: 'This workspace needs an active plan. Update payment to continue.',
      };
  }
}

/**
 * Owner / billing-manager banner for non-full_access SaaS states.
 * Not shown on client-facing `/book` or `/portal` surfaces.
 */
export function BillingAccessBanner({
  accountId,
  accountSlug,
  billingPath,
  level,
  status,
  hasStripeCustomer,
}: BillingAccessBannerProps) {
  const { title, body, tone } = copyFor(level, status);

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'region'}
      aria-label={title}
      className={cn(
        'mx-auto w-full max-w-[1600px] px-4 pt-3 sm:px-6',
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
          tone === 'warning'
            ? 'border-[color-mix(in_srgb,var(--ozer-coral-500)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-coral-500)_10%,var(--workspace-shell-panel))]'
            : 'border-destructive/40 bg-destructive/10',
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle
            className={cn(
              'mt-0.5 h-5 w-5 shrink-0',
              tone === 'warning'
                ? 'text-[var(--ozer-accent)]'
                : 'text-destructive',
            )}
            aria-hidden
          />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              {title}
            </p>
            <p className="text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
              {body}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pl-4">
          {hasStripeCustomer && status !== 'canceled' ? (
            <UpdatePaymentMethodButton
              accountId={accountId}
              accountSlug={accountSlug}
              intent="recover"
              size="sm"
              className="rounded-lg"
            />
          ) : (
            <Button asChild size="sm" className="ozer-gradient-btn rounded-lg">
              <Link href={`${billingPath}?billing=1`}>
                <CreditCard className="mr-2 h-4 w-4" aria-hidden />
                {status === 'canceled' ? 'View billing' : 'Update payment method'}
              </Link>
            </Button>
          )}
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="text-[var(--workspace-shell-text-muted)]"
          >
            <Link href={billingPath}>View billing</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

