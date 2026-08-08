'use client';

import { useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

import type { PortalCreditsBundle } from '../_lib/types/portal-credits.types';
import { createPortalCreditTopupAction } from '../_lib/server/server-actions';

function formatPounds(pence: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function rolloverCopy(
  policy: PortalCreditsBundle['rolloverPolicy'],
  cap: number | null,
) {
  if (policy === 'rollover') {
    return 'Unused credits roll over indefinitely.';
  }
  if (policy === 'cap') {
    return `Unused credits roll over, up to a banked cap of ${cap ?? 0}.`;
  }
  if (policy === 'expire') {
    return 'Unused credits expire at the end of each billing cycle.';
  }
  return 'Your agency has not set a rollover policy on an active retainer yet.';
}

function transactionLabel(type: string) {
  switch (type) {
    case 'grant':
      return 'Credits added';
    case 'consume':
      return 'Used on a request';
    case 'refund':
      return 'Refunded';
    case 'expire':
      return 'Expired';
    case 'manual_adjustment':
      return 'Adjustment';
    default:
      return type;
  }
}

export function PortalCreditsContent({
  clientOrgId,
  clientSlug,
  bundle,
}: {
  clientOrgId: string;
  clientSlug: string;
  bundle: PortalCreditsBundle;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const supportHref = pathsConfig.app.clientPortalSupport.replace(
    '[clientSlug]',
    clientSlug,
  );

  function buyPack(packId: 'small' | 'medium' | 'large') {
    startTransition(async () => {
      try {
        const result = await createPortalCreditTopupAction({
          clientOrgId,
          clientSlug,
          packId,
        });
        if (!result.publicToken) {
          toast.error('Top-up invoice created but payment link is missing');
          return;
        }
        router.push(`/portal/invoices/${result.publicToken}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not start top-up',
        );
      }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          Credits
        </h2>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          Credits power billable requests. Your balance updates when invoices
          are paid and when work starts on a ticket.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
            Balance
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ozer-text-on-light)]">
            {bundle.balance}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
            Next renewal
          </p>
          <p className="mt-2 text-lg font-medium text-[var(--ozer-text-on-light)]">
            {formatDate(bundle.nextRenewalDate)}
          </p>
          {bundle.planName ? (
            <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
              {bundle.planName}
              {bundle.creditsPerCycle != null
                ? ` · ${bundle.creditsPerCycle}/cycle`
                : null}
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:col-span-1">
          <p className="text-xs font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
            Rollover
          </p>
          <p className="mt-2 text-sm text-[var(--ozer-text-on-light)]">
            {rolloverCopy(bundle.rolloverPolicy, bundle.rolloverCap)}
          </p>
        </div>
      </div>

      {bundle.pendingCreditTicketCount > 0 ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {bundle.pendingCreditTicketCount} request
          {bundle.pendingCreditTicketCount === 1 ? '' : 's'} waiting on credits.{' '}
          <Link href={supportHref} className="font-medium underline">
            View services
          </Link>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--ozer-text-on-light)]">
          Top up
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {bundle.topupPacks.map((pack) => (
            <div
              key={pack.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="font-medium text-[var(--ozer-text-on-light)]">
                  {pack.label}
                </p>
                <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                  {formatPounds(pack.totalPence)}
                </p>
              </div>
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  buyPack(pack.id as 'small' | 'medium' | 'large')
                }
              >
                {pending ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : null}
                Buy
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-[var(--ozer-text-on-light)]">
          History
        </h3>
        {bundle.transactions.length === 0 ? (
          <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
            No credit activity yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {bundle.transactions.map((tx) => {
              const signed =
                tx.type === 'consume' || tx.type === 'expire'
                  ? -Math.abs(tx.amount)
                  : tx.amount;
              return (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-[var(--ozer-text-on-light)]">
                    {transactionLabel(tx.type)}
                  </p>
                  <p className="text-[var(--ozer-text-on-light-muted)]">
                    {formatDate(tx.createdAt)}
                  </p>
                </div>
                <p
                  className={
                    signed >= 0
                      ? 'font-medium text-emerald-700'
                      : 'font-medium text-rose-700'
                  }
                >
                  {signed > 0 ? '+' : ''}
                  {signed}
                </p>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
