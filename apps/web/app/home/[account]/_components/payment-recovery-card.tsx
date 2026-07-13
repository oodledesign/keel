import { CreditCard } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';

import type { AccountBillingStatus } from '~/lib/billing/account-billing-types';
import { isBillingRecoveryStatus } from '~/lib/billing/billing-recovery';

import { UpdatePaymentMethodButton } from './update-payment-method-button';

type PaymentRecoveryCardProps = {
  accountId: string;
  accountSlug: string;
  status: AccountBillingStatus | null;
  hasStripeCustomer: boolean;
  /** Returned from Customer Portal with ?payment_updated=1 */
  paymentUpdated?: boolean;
  /** Lifecycle already back to active after portal return */
  recovered?: boolean;
};

function copyForStatus(status: AccountBillingStatus | null): {
  title: string;
  body: string;
} {
  switch (status) {
    case 'past_due_grace':
      return {
        title: 'Payment failed — update your card',
        body: 'We could not collect your latest payment. Your workspace still has full access while we retry. Update your payment method in Stripe’s secure portal — Stripe will retry the invoice automatically.',
      };
    case 'past_due_restricted':
      return {
        title: 'Update payment to restore full access',
        body: 'This workspace is restricted because payment is overdue. Update your card and Stripe will retry the unpaid invoice. Once it succeeds, access is restored automatically.',
      };
    case 'suspended':
      return {
        title: 'Reactivate your workspace',
        body: 'Access is blocked until we can collect payment. Update your payment method — Stripe retries the outstanding invoice, then we restore the workspace and email you.',
      };
    case 'trial_expired':
      return {
        title: 'Subscribe to continue',
        body: 'Your trial has ended. Open billing to choose a plan, or update payment if a subscription invoice is waiting.',
      };
    default:
      return {
        title: 'Update payment method',
        body: 'Use Stripe’s Customer Portal to update your card. Successful payment restores access automatically.',
      };
  }
}

/**
 * Customer-facing payment recovery (v1 = hosted Stripe Customer Portal).
 */
export function PaymentRecoveryCard({
  accountId,
  accountSlug,
  status,
  hasStripeCustomer,
  paymentUpdated = false,
  recovered = false,
}: PaymentRecoveryCardProps) {
  if (recovered) {
    return (
      <Alert className="border-[color-mix(in_srgb,var(--ozer-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--ozer-accent)_10%,transparent)]">
        <CreditCard className="h-4 w-4 text-[var(--ozer-accent)]" />
        <AlertTitle>You’re back</AlertTitle>
        <AlertDescription>
          Payment succeeded and full workspace access is restored. Welcome back.
        </AlertDescription>
      </Alert>
    );
  }

  if (paymentUpdated && isBillingRecoveryStatus(status)) {
    return (
      <Alert>
        <CreditCard className="h-4 w-4" />
        <AlertTitle>Payment method updated</AlertTitle>
        <AlertDescription>
          Stripe is retrying any open invoice. This page will show full access
          again once payment succeeds — usually within a minute. You’ll also get
          a confirmation email.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isBillingRecoveryStatus(status) || !hasStripeCustomer) {
    return null;
  }

  const { title, body } = copyForStatus(status);

  return (
    <Card className="border-[color-mix(in_srgb,var(--ozer-coral-500)_35%,transparent)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          {body}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0 sm:flex-row sm:items-center">
        <UpdatePaymentMethodButton
          accountId={accountId}
          accountSlug={accountSlug}
          intent="recover"
          label="Update payment method"
        />
        <p className="text-xs text-muted-foreground">
          Opens Stripe’s secure Customer Portal — no card details are entered in
          Ozer.
        </p>
      </CardContent>
    </Card>
  );
}
