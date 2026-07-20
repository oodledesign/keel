'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { formatPence } from '~/home/[account]/invoices/_lib/invoice-totals';
import { useWorkspaceCurrency } from '~/lib/currency/use-workspace-currency';

import { loadClientFinanceAction } from '../_lib/server/client-finance.actions';

type ClientFinanceData = Awaited<ReturnType<typeof loadClientFinanceAction>>;

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

function formatValue(
  pence: number | null | undefined,
  currencyCode: string,
): string {
  if (pence == null) return '—';
  return formatPence(pence, currencyCode);
}

export function ClientFinancePanel({
  accountId,
  accountSlug,
  clientId,
}: {
  accountId: string;
  accountSlug: string;
  clientId: string;
}) {
  const workspaceCurrency = useWorkspaceCurrency();
  const currencyCode = workspaceCurrency.toUpperCase();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ClientFinanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const financesHref = pathsConfig.app.accountFinances.replace(
    '[account]',
    accountSlug,
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    startTransition(async () => {
      try {
        const result = await loadClientFinanceAction({ accountId, clientId });
        setData(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not load finance data',
        );
        setData(null);
      } finally {
        setLoading(false);
      }
    });
  }, [accountId, clientId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        Loading client finance…
      </p>
    );
  }

  if (error && !data) {
    return (
      <div className={cn(panelClass, 'p-4')}>
        <p className="text-sm text-red-300">{error}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 border-[color:var(--workspace-shell-border)]"
          onClick={load}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, transactions } = data;
  const hasTransactions = transactions.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Real net from bank transactions tagged to this client in Finances.
          </p>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            Tag transactions on the{' '}
            <Link
              href={financesHref}
              className="text-[var(--workspace-shell-text-muted)] underline hover:text-[var(--workspace-shell-text)]"
            >
              Finances
            </Link>{' '}
            page to build this view.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[color:var(--workspace-shell-border)]"
          disabled={pending}
          onClick={load}
        >
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Income"
          value={formatPence(summary.incomePence, currencyCode)}
          tone="positive"
        />
        <MetricCard
          label="Expenses"
          value={formatPence(summary.expensePence, currencyCode)}
          tone="negative"
        />
        <MetricCard
          label="Real net"
          value={formatPence(summary.netPence, currencyCode)}
          tone={summary.netPence >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {summary.projectCount > 0 ? (
        <div className={cn(panelClass, 'p-4')}>
          <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Compared to project estimates
          </h3>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-[var(--workspace-shell-text-muted)]">
                Total quoted / estimated value ({summary.projectCount} project
                {summary.projectCount === 1 ? '' : 's'})
              </dt>
              <dd className="mt-0.5 text-[var(--workspace-shell-text)]">
                {formatValue(summary.estimatedValuePence, currencyCode)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--workspace-shell-text-muted)]">
                Total estimated cost
              </dt>
              <dd className="mt-0.5 text-[var(--workspace-shell-text)]">
                {formatValue(summary.estimatedCostPence, currencyCode)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--workspace-shell-text-muted)]">
                Real net vs total value
              </dt>
              <dd className="mt-0.5 text-[var(--workspace-shell-text)]">
                {summary.estimatedValuePence > 0
                  ? formatPence(
                      summary.netPence - summary.estimatedValuePence,
                      currencyCode,
                    )
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--workspace-shell-text-muted)]">
                Real net vs total cost
              </dt>
              <dd className="mt-0.5 text-[var(--workspace-shell-text)]">
                {summary.estimatedCostPence > 0
                  ? formatPence(
                      summary.netPence - summary.estimatedCostPence,
                      currencyCode,
                    )
                  : '—'}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {summary.transferPence > 0 ? (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {formatPence(summary.transferPence, currencyCode)} in internal
          transfers excluded from net.
        </p>
      ) : null}

      <div className={cn(panelClass, 'overflow-hidden')}>
        <div className="border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
          <h3 className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Linked transactions
          </h3>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {summary.linkedCount} income/expense
            {summary.transferCount > 0
              ? ` · ${summary.transferCount} transfer${summary.transferCount === 1 ? '' : 's'}`
              : ''}
          </p>
        </div>

        {!hasTransactions ? (
          <div className="space-y-2 p-4 text-sm text-[var(--workspace-shell-text-muted)]">
            <p>No transactions tagged to this client yet.</p>
            <Link
              href={financesHref}
              className="text-[var(--ozer-accent)] underline hover:text-[var(--workspace-shell-text)]"
            >
              Open Finances to tag transactions →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--workspace-shell-border)] text-left text-xs text-[var(--workspace-shell-text-muted)] uppercase">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const pence = tx.amount_pence as number;
                  const isTransfer = Boolean(tx.is_transfer);
                  return (
                    <tr
                      key={tx.id as string}
                      className="border-b border-[color:var(--workspace-shell-border)] last:border-0"
                    >
                      <td className="px-4 py-2 whitespace-nowrap text-[var(--workspace-shell-text-muted)]">
                        {String(tx.transaction_date)}
                      </td>
                      <td className="max-w-xs truncate px-4 py-2 text-[var(--workspace-shell-text)]">
                        {String(tx.description)}
                        {isTransfer ? (
                          <span className="ml-2 text-xs text-[var(--workspace-shell-text-muted)]">
                            transfer
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-2 font-medium whitespace-nowrap',
                          isTransfer
                            ? 'text-[var(--workspace-shell-text-muted)]'
                            : pence >= 0
                              ? 'text-emerald-400'
                              : 'text-red-300',
                        )}
                      >
                        {formatPence(Math.abs(pence), currencyCode)}
                        {!isTransfer ? (pence < 0 ? ' out' : ' in') : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard(props: {
  label: string;
  value: string;
  tone: 'positive' | 'negative';
}) {
  return (
    <div className={panelClass + ' p-4'}>
      <p className="text-xs tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        {props.label}
      </p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          props.tone === 'positive' ? 'text-emerald-400' : 'text-red-300',
        )}
      >
        {props.value}
      </p>
    </div>
  );
}
