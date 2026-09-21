'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import {
  activateOfflineClientSubscriptionAction,
  cancelClientSubscriptionAction,
  listClientSubscriptionsAction,
  resendClientSubscriptionPaymentLinkAction,
} from '~/home/[account]/settings/services/_lib/server/plan-templates-actions';
import {
  canRemoveClientSubscription,
  isVisibleAgencyClientSubscription,
} from '~/lib/billing/client-subscription-lifecycle';
import {
  clientSubscriptionStatusLabel,
  clientSubscriptionStatusStyles,
} from '~/lib/billing/client-subscription-status';
import {
  type ClientSubscriptionRecord,
  type ClientSubscriptionStatus,
  canActivateClientSubscriptionOffline,
  canResendClientSubscriptionPaymentLink,
  clientSubscriptionBillingLabel,
  formatMinorUnits,
} from '~/lib/billing/plan-templates-types';
import { workspaceTextMuted } from '~/lib/workspace-ui';

import {
  CLIENT_SUBSCRIPTIONS_CHANGED_EVENT,
  notifyClientSubscriptionsChanged,
} from '../_lib/client-subscriptions-events';

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
      data-test="resend-subscription-payment-link"
    >
      {pending ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
      Resend payment link
    </Button>
  );
}

function ActivateOfflineButton({
  accountId,
  subscriptionId,
  onActivated,
}: {
  accountId: string;
  subscriptionId: string;
  onActivated: (row: ClientSubscriptionRecord) => void;
}) {
  const [pending, startTransition] = useTransition();

  function onActivate() {
    startTransition(async () => {
      try {
        const result = await activateOfflineClientSubscriptionAction({
          accountId,
          subscriptionId,
        });
        onActivated(result);
        toast.success('Plan activated — billed offline (no Stripe collection)');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not activate',
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
      onClick={onActivate}
      data-test="activate-subscription-offline"
    >
      {pending ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
      Activate offline
    </Button>
  );
}

export function ClientSubscriptionStatusList({
  accountId,
  clientId,
  websiteId,
  projectId,
  canEdit,
  emptyLabel,
}: {
  accountId: string;
  clientId?: string;
  websiteId?: string;
  projectId?: string;
  canEdit: boolean;
  emptyLabel?: string;
}) {
  const [rows, setRows] = useState<ClientSubscriptionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function applyRows(data: ClientSubscriptionRecord[]) {
      setRows(
        data.filter((row) => isVisibleAgencyClientSubscription(row.status)),
      );
      setLoaded(true);
    }

    function load() {
      void listClientSubscriptionsAction({
        accountId,
        clientId,
        websiteId,
        projectId,
      })
        .then((data) => {
          if (!cancelled) applyRows(data);
        })
        .catch(() => {
          if (!cancelled) {
            setRows([]);
            setLoaded(true);
          }
        });
    }

    load();
    window.addEventListener(CLIENT_SUBSCRIPTIONS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(CLIENT_SUBSCRIPTIONS_CHANGED_EVENT, load);
    };
  }, [accountId, clientId, websiteId, projectId]);

  if (!loaded) {
    return null;
  }

  if (rows.length === 0) {
    return (
      <p className={`mt-3 text-sm ${workspaceTextMuted}`}>
        {emptyLabel ??
          'No plan attached. Add a retainer on this project to collect payment.'}
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-2">
      {rows.map((sub) => {
        const showResend =
          canEdit && canResendClientSubscriptionPaymentLink(sub);
        const showActivateOffline =
          canEdit && canActivateClientSubscriptionOffline(sub);
        const showRemove = canEdit && canRemoveClientSubscription(sub.status);
        const billingLabel = clientSubscriptionBillingLabel(
          sub.billingCollection,
        );

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
              <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>
                {formatMinorUnits(sub.monthlyAmount, sub.currency, 'month')}
                {billingLabel ? ` · ${billingLabel}` : null}
              </p>
            </div>
            {showResend || showActivateOffline || showRemove ? (
              <div className="flex flex-wrap items-center gap-2">
                {showActivateOffline ? (
                  <ActivateOfflineButton
                    accountId={accountId}
                    subscriptionId={sub.id}
                    onActivated={(updated) => {
                      setRows((current) =>
                        current.map((row) =>
                          row.id === updated.id ? updated : row,
                        ),
                      );
                    }}
                  />
                ) : null}
                {showResend ? (
                  <ResendPaymentLinkButton
                    accountId={accountId}
                    subscriptionId={sub.id}
                  />
                ) : null}
                {showRemove ? (
                  <RemoveRetainerButton
                    accountId={accountId}
                    subscription={sub}
                    onRemoved={() => {
                      setRows((current) =>
                        current.filter((row) => row.id !== sub.id),
                      );
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function RemoveRetainerButton({
  accountId,
  subscription,
  onRemoved,
}: {
  accountId: string;
  subscription: ClientSubscriptionRecord;
  onRemoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const stripeLinked = Boolean(subscription.stripeSubscriptionId);

  function onConfirm() {
    startTransition(async () => {
      try {
        await cancelClientSubscriptionAction({
          accountId,
          subscriptionId: subscription.id,
        });
        notifyClientSubscriptionsChanged();
        onRemoved();
        toast.success('Retainer removed');
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not remove retainer',
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => setOpen(true)}
        data-test="remove-retainer"
      >
        Remove
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {subscription.planName ?? 'this retainer'}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-[var(--workspace-shell-text-muted)]">
                <p>
                  The client will lose portal access to this plan. It will no
                  longer appear as active or awaiting payment.
                </p>
                {stripeLinked ? (
                  <p>
                    A Stripe subscription is linked. It will be cancelled
                    immediately (not at period end), matching existing Ozer
                    cancel behaviour.
                  </p>
                ) : (
                  <p>
                    Any unpaid Stripe checkout link for this retainer will stop
                    working.
                  </p>
                )}
                <p>
                  Credit burn history is kept. Unused credits stay on the
                  project until you adjust them.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={pending}
              className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
            >
              Keep retainer
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
              data-test="confirm-remove-retainer"
            >
              {pending ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : null}
              Remove retainer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { SubscriptionStatusPill };
