'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Plus, Trash2, TrendingUp } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';

import { useWorkspaceCurrency } from '~/lib/currency/use-workspace-currency';
import {
  formatWorkspaceAmount,
  workspaceCurrencySymbol,
} from '~/lib/currency/workspace-currency';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { PropertyValuation } from '../../_lib/server/properties.service';
import {
  deletePropertyValuation,
  upsertPropertyValuation,
} from '../../_lib/server/server-actions';

interface PropertyValueHistoryProps {
  propertyId: string;
  accountId: string;
  valuations: PropertyValuation[];
}

function currentMonthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(iso: string) {
  try {
    return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(
      'en-GB',
      {
        month: 'long',
        year: 'numeric',
      },
    );
  } catch {
    return iso;
  }
}

export function PropertyValueHistory({
  propertyId,
  accountId,
  valuations: initialValuations,
}: PropertyValueHistoryProps) {
  const router = useRouter();
  const workspaceCurrency = useWorkspaceCurrency();
  const formatMoney = (value: number) =>
    formatWorkspaceAmount(value, workspaceCurrency);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonthInput);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const pounds = parseFloat(amount);
    if (!month || Number.isNaN(pounds) || pounds < 0) {
      setError('Enter a month and a valid value.');
      return;
    }

    startTransition(async () => {
      try {
        await upsertPropertyValuation({
          propertyId,
          accountId,
          valuedMonth: month,
          valueAmount: Math.round(pounds * 100),
          notes: notes.trim() || null,
        });
        setAmount('');
        setNotes('');
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to save valuation',
        );
      }
    });
  };

  const handleDelete = (valuationId: string) => {
    if (!confirm('Remove this valuation?')) return;
    setError(null);
    startTransition(async () => {
      try {
        await deletePropertyValuation({ valuationId });
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to delete valuation',
        );
      }
    });
  };

  const latest = initialValuations[0] ?? null;
  const previous = initialValuations[1] ?? null;
  const change =
    latest && previous ? latest.valueAmount - previous.valueAmount : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Value over time
          </h3>
          <p className="text-xs text-[var(--workspace-shell-text)]/45">
            Record an estimated value for each month to track appreciation.
          </p>
        </div>
        {latest ? (
          <div className="text-right">
            <p className="text-lg font-semibold text-[var(--workspace-shell-text)]">
              {formatMoney(latest.valueAmount / 100)}
            </p>
            <p className="text-xs text-[var(--workspace-shell-text)]/45">
              as of {formatMonth(latest.valuedMonth)}
              {change != null ? (
                <span
                  className={
                    change >= 0
                      ? 'text-[var(--ozer-accent-muted)]'
                      : 'text-[var(--workspace-shell-text-muted)]'
                  }
                >
                  {' '}
                  · {change >= 0 ? '+' : ''}
                  {formatMoney(change / 100)} vs prior
                </span>
              ) : null}
            </p>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleAdd}
        className="grid gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">Month</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Estimated value ({workspaceCurrencySymbol(workspaceCurrency)})
          </Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
          />
        </div>
        <div className="flex items-end">
          <Button
            type="submit"
            disabled={isPending}
            className={workspaceBtnPrimaryMd}
          >
            <Plus className="h-4 w-4" />
            {isPending ? 'Saving…' : 'Add value'}
          </Button>
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <Label className="text-[var(--workspace-shell-text)]/70">
            Notes (optional)
          </Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Estate agent appraisal"
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30"
          />
        </div>
      </form>

      {error ? (
        <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {initialValuations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] py-10 text-center">
          <TrendingUp className="mb-2 h-8 w-8 text-[var(--workspace-shell-text)]/20" />
          <p className="text-sm text-[var(--workspace-shell-text)]/45">
            No valuations yet
          </p>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text)]/35">
            Add this month&apos;s value, then another later to see change over
            time.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-xl border border-[color:var(--workspace-shell-border)]">
          {initialValuations.map((valuation, index) => {
            const prior = initialValuations[index + 1];
            const delta = prior
              ? valuation.valueAmount - prior.valueAmount
              : null;
            return (
              <li
                key={valuation.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                    {formatMonth(valuation.valuedMonth)}
                  </p>
                  {valuation.notes ? (
                    <p className="truncate text-xs text-[var(--workspace-shell-text)]/45">
                      {valuation.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                      {formatMoney(valuation.valueAmount / 100)}
                    </p>
                    {delta != null ? (
                      <p className="text-[11px] text-[var(--workspace-shell-text)]/45">
                        {delta >= 0 ? '+' : ''}
                        {formatMoney(delta / 100)}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    onClick={() => handleDelete(valuation.id)}
                    className="h-8 w-8 text-[var(--workspace-shell-text)]/35 hover:text-rose-600"
                    aria-label="Delete valuation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
