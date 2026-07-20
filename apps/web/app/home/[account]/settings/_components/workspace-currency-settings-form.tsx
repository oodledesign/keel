'use client';

import { useEffect, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import {
  WORKSPACE_CURRENCY_OPTIONS,
  type WorkspaceCurrency,
  normalizeWorkspaceCurrency,
} from '~/lib/currency/workspace-currency';

import { saveWorkspaceCurrency } from '../_lib/server/workspace-currency-actions';

export function WorkspaceCurrencySettingsForm({
  accountId,
  accountSlug,
  initialCurrency,
  canEdit,
  stripeConnected = false,
}: {
  accountId: string;
  accountSlug: string;
  initialCurrency: string;
  canEdit: boolean;
  stripeConnected?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [currency, setCurrency] = useState<WorkspaceCurrency>(() =>
    normalizeWorkspaceCurrency(initialCurrency),
  );

  useEffect(() => {
    setCurrency(normalizeWorkspaceCurrency(initialCurrency));
  }, [initialCurrency]);

  const handleChange = (next: WorkspaceCurrency) => {
    if (!canEdit || next === currency) return;
    setCurrency(next);
    startTransition(async () => {
      try {
        await saveWorkspaceCurrency({
          accountId,
          default_currency: next,
        });
        toast.success('Workspace currency saved');
        router.refresh();
      } catch {
        setCurrency(normalizeWorkspaceCurrency(initialCurrency));
        toast.error('Failed to save workspace currency');
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
      <div>
        <h2 className="text-base font-semibold">Workspace currency</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Used across finances, properties, invoices, proposals, and contracts.
          Property values and finance totals are shown in this currency. You can
          still override currency on individual invoices and documents where
          supported.
        </p>
        {stripeConnected ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Card payments require your connected Stripe account to support the
            chosen currency.
          </p>
        ) : null}
      </div>

      {!canEdit ? (
        <p className="text-muted-foreground text-sm">
          Only workspace owners and admins can change currency.
        </p>
      ) : (
        <div className="max-w-md">
          <Label htmlFor="workspace-default-currency">Default currency</Label>
          <select
            id="workspace-default-currency"
            value={currency}
            disabled={pending || !canEdit}
            onChange={(e) => handleChange(e.target.value as WorkspaceCurrency)}
            className="mt-1 flex h-10 w-full rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 text-sm text-[var(--workspace-shell-text)]"
          >
            {WORKSPACE_CURRENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <Link
        href={pathsConfig.app.accountPaymentSettings.replace(
          '[account]',
          accountSlug,
        )}
        className="text-sm text-[var(--ozer-accent)] hover:underline"
      >
        Payment settings →
      </Link>
    </div>
  );
}
