import { Button } from '@kit/ui/button';

import { clientSubscriptionCheckoutHref } from '~/lib/billing/client-subscription-lifecycle';
import { formatMinorUnits } from '~/lib/billing/plan-templates-types';

export type PortalPendingRetainerPayItem = {
  id: string;
  planName: string;
  amountPence: number;
  currency: string;
  interval?: 'month' | 'year';
};

export function PortalPendingRetainerPayCard({
  item,
}: {
  item: PortalPendingRetainerPayItem;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)] px-3 py-3"
      data-test="portal-pending-retainer"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium tracking-wide text-[var(--ozer-accent)] uppercase">
          Awaiting payment
        </p>
        <p className="font-medium text-[var(--ozer-text-on-light)]">
          {item.planName}
        </p>
        <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
          {formatMinorUnits(item.amountPence, item.currency, item.interval)}
        </p>
      </div>
      <Button
        asChild
        size="sm"
        className="workspace-btn-primary h-8 rounded-md px-3 text-xs"
        data-test="portal-pay-retainer"
      >
        <a href={clientSubscriptionCheckoutHref(item.id)}>Pay now</a>
      </Button>
    </div>
  );
}

export function PortalPendingRetainerPayList({
  items,
}: {
  items: PortalPendingRetainerPayItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <PortalPendingRetainerPayCard key={item.id} item={item} />
      ))}
    </div>
  );
}
