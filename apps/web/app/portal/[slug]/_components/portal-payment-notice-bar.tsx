import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import type { PortalPaymentNotice } from '~/lib/billing/portal-payment-notice';

import { ManagePaymentMethodButton } from './manage-payment-method-button';

export function PortalPaymentNoticeBar({
  notice,
  clientOrgId,
  clientSlug,
  contentClassName,
}: {
  notice: PortalPaymentNotice;
  clientOrgId: string;
  clientSlug: string;
  contentClassName?: string;
}) {
  const billingHref = pathsConfig.app.clientPortalBilling.replace(
    '[clientSlug]',
    clientSlug,
  );
  const planName = notice.planName;
  const message =
    notice.kind === 'issue'
      ? `We couldn't collect payment for ${planName}. Update your payment method to keep the subscription active.`
      : `Payment needed to activate ${planName}. Complete checkout to start the subscription.`;

  return (
    <div
      className="border-b border-[color:var(--ozer-accent)]/30 bg-[var(--ozer-coral-50)]"
      data-test="portal-payment-notice"
      role="status"
    >
      <div
        className={cn(
          'flex w-full flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between',
          contentClassName,
        )}
      >
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-[var(--ozer-accent)] uppercase">
            {notice.kind === 'issue' ? 'Payment issue' : 'Payment needed'}
          </p>
          <p className="text-sm text-[var(--workspace-shell-text)]">
            {message}
          </p>
          {notice.extraCount > 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              {notice.extraCount} more{' '}
              {notice.extraCount === 1 ? 'subscription' : 'subscriptions'} also{' '}
              {notice.kind === 'issue' ? 'need attention' : 'await payment'}.{' '}
              <Link href={billingHref} className="font-medium underline">
                Review billing
              </Link>
            </p>
          ) : null}
        </div>

        {notice.kind === 'pending' && notice.checkoutHref ? (
          <a
            href={notice.checkoutHref}
            className="workspace-btn-primary inline-flex h-8 shrink-0 items-center justify-center rounded-md px-3 text-xs font-medium"
            data-test="portal-payment-notice-pay"
          >
            Pay now
          </a>
        ) : (
          <ManagePaymentMethodButton
            clientOrgId={clientOrgId}
            clientSlug={clientSlug}
            label="Fix payment"
            appearance="primary"
            className="workspace-btn-primary h-8 shrink-0 rounded-md px-3 text-xs"
            testId="portal-payment-notice-fix"
          />
        )}
      </div>
    </div>
  );
}
