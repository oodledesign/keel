'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import {
  listClientSubscriptionsAction,
  resendClientSubscriptionPaymentLinkAction,
} from '~/home/[account]/settings/services/_lib/server/plan-templates-actions';
import {
  clientSubscriptionStatusLabel,
  clientSubscriptionStatusStyles,
} from '~/lib/billing/client-subscription-status';
import {
  type ClientSubscriptionRecord,
  type ClientSubscriptionStatus,
  formatMinorUnits,
} from '~/lib/billing/plan-templates-types';

function SubscriptionStatusPill({ status }: { status: string }) {
  const key = (
    status in clientSubscriptionStatusStyles ? status : 'pending'
  ) as ClientSubscriptionStatus;
  const style = clientSubscriptionStatusStyles[key];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      {clientSubscriptionStatusLabel(status)}
    </span>
  );
}

function ResendPaymentLinkButton({
  accountId,
  subscriptionId,
}: {
  accountId: string;
  subscriptionId: string;
}) {
  const [pending, startTransition] = useTransition();

  function onResend() {
    startTransition(async () => {
      try {
        const result = await resendClientSubscriptionPaymentLinkAction({
          accountId,
          subscriptionId,
        });
        await navigator.clipboard.writeText(result.url);
        toast.success('Payment link copied — send it to your client');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create link',
        );
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={onResend}
    >
      {pending ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
      Resend payment link
    </Button>
  );
}

export function ClientSubscriptionStatusList({
  accountId,
  clientId,
  websiteId,
  canEdit,
}: {
  accountId: string;
  clientId?: string;
  websiteId?: string;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<ClientSubscriptionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listClientSubscriptionsAction({
      accountId,
      clientId,
      websiteId,
    })
      .then((data) => {
        if (!cancelled) {
          setRows(
            data.filter(
              (row) =>
                row.status === 'active' ||
                row.status === 'overdue' ||
                row.status === 'cancelled' ||
                row.status === 'incomplete' ||
                row.status === 'pending',
            ),
          );
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, clientId, websiteId]);

  if (!loaded || rows.length === 0) {
    return null;
  }

  return (
    <ul className="mt-3 space-y-2">
      {rows.map((sub) => {
        const showResend =
          canEdit &&
          (sub.status === 'overdue' ||
            sub.status === 'incomplete' ||
            sub.status === 'pending');

        return (
          <li
            key={sub.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                  {sub.planName ?? 'Subscription'}
                </p>
                <SubscriptionStatusPill status={sub.status} />
              </div>
              <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                {formatMinorUnits(sub.monthlyAmount, sub.currency, 'month')}
              </p>
            </div>
            {showResend ? (
              <ResendPaymentLinkButton
                accountId={accountId}
                subscriptionId={sub.id}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export { SubscriptionStatusPill };
