'use client';

import { CreditCard } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { createBillingPortalSession } from '~/home/[account]/billing/_lib/server/server-actions';

type UpdatePaymentMethodButtonProps = {
  accountId: string;
  accountSlug: string;
  /** recover = deep-link to Stripe payment method update */
  intent?: 'manage' | 'recover';
  label?: string;
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
};

/**
 * v1 payment recovery: hosted Stripe Customer Portal (not in-app Elements).
 * Stripe retries the open invoice after the card is updated — no extra Ozer logic.
 */
export function UpdatePaymentMethodButton({
  accountId,
  accountSlug,
  intent = 'recover',
  label = 'Update payment method',
  size = 'default',
  className,
  variant = 'default',
}: UpdatePaymentMethodButtonProps) {
  return (
    <form action={createBillingPortalSession}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="slug" value={accountSlug} />
      <input type="hidden" name="intent" value={intent} />
      <Button
        type="submit"
        size={size}
        variant={variant}
        className={cn(variant === 'default' && 'ozer-gradient-btn', className)}
      >
        <CreditCard className="mr-2 h-4 w-4" aria-hidden />
        {label}
      </Button>
    </form>
  );
}
