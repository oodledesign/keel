'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { CreditCard, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';
import { stripeConnectErrorMessage } from '~/lib/billing/stripe-connect-messages';

import type { AccountPaymentSettings } from '../../../invoices/_lib/server/invoice-payment-settings.service';
import {
  disconnectStripeAction,
  savePaymentSettingsAction,
} from '../../../invoices/_lib/server/server-actions';

function penceToPoundsInput(pence: number | null | undefined): string {
  if (pence == null || pence === 0) return '';
  return (pence / 100).toFixed(2);
}

function poundsInputToPence(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function PaymentSettingsForm({
  accountId,
  accountSlug,
  initialSettings,
  canEdit,
  highestInvoiceSequence,
}: {
  accountId: string;
  accountSlug: string;
  initialSettings: AccountPaymentSettings;
  canEdit: boolean;
  /** Highest INV-#### already issued (0 if none). */
  highestInvoiceSequence: number;
}) {
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [settings, setSettings] = useState(initialSettings);
  const [hourlyRateInput, setHourlyRateInput] = useState(() =>
    penceToPoundsInput(initialSettings.default_hourly_rate_pence),
  );

  const stripeConnected = Boolean(
    settings.stripe_connect_enabled && settings.stripe_account_id,
  );
  const connectError = searchParams.get('stripe_connect_error');
  const stripeConnectedFlash = searchParams.get('stripe_connected') === '1';

  const settingsPath = pathsConfig.app.accountPaymentSettings.replace(
    '[account]',
    accountSlug,
  );

  const handleSave = () => {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        const saved = await savePaymentSettingsAction({
          accountId,
          bank_account_name: settings.bank_account_name,
          bank_sort_code: settings.bank_sort_code,
          bank_account_number: settings.bank_account_number,
          bank_iban: settings.bank_iban,
          bank_bic: settings.bank_bic,
          bank_transfer_enabled: settings.bank_transfer_enabled,
          bank_transfer_instructions: settings.bank_transfer_instructions,
          stripe_pay_now_enabled: settings.stripe_pay_now_enabled,
          stripe_card_fee_mode: settings.stripe_card_fee_mode,
          invoice_starting_number: settings.invoice_starting_number,
          default_hourly_rate_pence: poundsInputToPence(hourlyRateInput),
          default_invoice_due_days: settings.default_invoice_due_days,
        });
        setSettings(saved as AccountPaymentSettings);
        setHourlyRateInput(
          penceToPoundsInput(
            (saved as AccountPaymentSettings).default_hourly_rate_pence,
          ),
        );
        toast.success('Payment settings saved');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Save failed');
      }
    });
  };

  const handleDisconnect = () => {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        const saved = await disconnectStripeAction({ accountId });
        setSettings(saved as AccountPaymentSettings);
        toast.success('Stripe disconnected');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Disconnect failed',
        );
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {stripeConnectedFlash ? (
        <div className="rounded-xl border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-4 py-3 text-sm text-[#97D9AA]">
          Stripe connected successfully. Card payments are now enabled on
          invoices.
        </div>
      ) : null}
      {connectError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {stripeConnectErrorMessage(connectError)}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Stripe Connect</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Accept card payments on invoices. Funds transfer to your connected
              Stripe account. Choose below how Stripe card fees are handled.
            </p>
          </div>
          {stripeConnected ? (
            <span className="rounded-full border border-emerald-700/40 bg-emerald-500/18 px-2.5 py-1 text-xs font-medium text-emerald-900">
              Connected
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canEdit && !stripeConnected ? (
            <Button
              asChild
              className="bg-[var(--ozer-accent)] text-[#09111F] hover:bg-[#6BD48F]"
            >
              <a
                href={`/api/stripe-connect/account-authorize?accountId=${encodeURIComponent(accountId)}`}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Connect Stripe
              </a>
            </Button>
          ) : null}
          {canEdit && stripeConnected ? (
            <Button
              variant="outline"
              disabled={pending}
              onClick={handleDisconnect}
            >
              Disconnect Stripe
            </Button>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-white/3 p-4">
          <div>
            <p className="text-sm font-medium">Pay by card on portal</p>
            <p className="text-muted-foreground text-xs">
              Show the Pay now button when Stripe is connected.
            </p>
          </div>
          <Switch
            checked={settings.stripe_pay_now_enabled}
            disabled={!canEdit || !stripeConnected}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({
                ...prev,
                stripe_pay_now_enabled: checked,
              }))
            }
          />
        </div>

        {stripeConnected ? (
          <div className="mt-4 space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-white/3 p-4">
            <div>
              <p className="text-sm font-medium">Card processing fees</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Stripe charges a card fee on every payment. Choose who covers
                it. Ozer does not keep a platform cut beyond covering that fee.
              </p>
            </div>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 has-[:checked]:border-[var(--ozer-accent)]/50">
                <input
                  type="radio"
                  name="stripe_card_fee_mode"
                  className="mt-1"
                  disabled={!canEdit}
              checked={
                (settings.stripe_card_fee_mode ?? 'absorb_in_payout') ===
                'absorb_in_payout'
              }
                  onChange={() =>
                    setSettings((prev) => ({
                      ...prev,
                      stripe_card_fee_mode: 'absorb_in_payout',
                    }))
                  }
                />
                <span>
                  <span className="block text-sm font-medium">
                    Deduct from what you receive
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    Client pays the invoice total. Stripe fees come out of your
                    payout.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 has-[:checked]:border-[var(--ozer-accent)]/50">
                <input
                  type="radio"
                  name="stripe_card_fee_mode"
                  className="mt-1"
                  disabled={!canEdit}
                  checked={
                    (settings.stripe_card_fee_mode ?? 'absorb_in_payout') ===
                    'pass_to_client'
                  }
                  onChange={() =>
                    setSettings((prev) => ({
                      ...prev,
                      stripe_card_fee_mode: 'pass_to_client',
                    }))
                  }
                />
                <span>
                  <span className="block text-sm font-medium">
                    Pass fees to the client
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    Client pays the invoice plus an estimated card fee at
                    checkout. You receive the full invoice amount.
                  </span>
                </span>
              </label>
            </div>
          </div>
        ) : null}

        {stripeConnected ? (
          <p className="text-muted-foreground mt-3 text-xs">
            Failed subscription payments use Stripe Smart Retries on your
            connected account (Billing → Revenue recovery → Retries in the
            Stripe Dashboard). Ozer does not email clients about failures — you
            get an in-app notification and a Past due status instead.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
        <h2 className="text-base font-semibold">Invoice defaults</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          New invoices use these defaults. Currency is set in{' '}
          <Link
            href={pathsConfig.app.accountSettings.replace(
              '[account]',
              accountSlug,
            )}
            className="text-[var(--ozer-accent)] hover:underline"
          >
            general workspace settings
          </Link>
          . You can still change currency on each draft invoice.
        </p>
        <div className="mt-4 grid max-w-md gap-4">
          <div>
            <Label htmlFor="invoice_starting_number">Next invoice number</Label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-muted-foreground text-sm">INV-</span>
              <Input
                id="invoice_starting_number"
                type="number"
                min={Math.max(1, highestInvoiceSequence + 1)}
                max={999999}
                value={settings.invoice_starting_number ?? 1}
                disabled={!canEdit}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setSettings((prev) => ({
                    ...prev,
                    invoice_starting_number: Number.isFinite(n)
                      ? Math.min(999999, Math.max(1, n))
                      : 1,
                  }));
                }}
                className="font-mono"
              />
            </div>
            {highestInvoiceSequence > 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Highest existing invoice is INV-
                {String(highestInvoiceSequence).padStart(4, '0')}. Choose a
                number greater than {highestInvoiceSequence}.
              </p>
            ) : (
              <p className="text-muted-foreground mt-2 text-xs">
                New invoices are numbered INV-0001, INV-0002, and so on.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="default_hourly_rate">Default hourly rate</Label>
            <Input
              id="default_hourly_rate"
              type="text"
              inputMode="decimal"
              disabled={!canEdit}
              value={hourlyRateInput}
              onChange={(e) => setHourlyRateInput(e.target.value)}
              placeholder="0.00"
              className="mt-1 max-w-xs font-mono"
            />
            <p className="text-muted-foreground mt-2 text-xs">
              Used when you add hours-based line items to an invoice. You can
              still mix quantity and hours lines on the same invoice.
            </p>
          </div>
          <div>
            <Label htmlFor="default_invoice_due_days">
              Default invoice due date
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="default_invoice_due_days"
                type="number"
                min={0}
                max={365}
                disabled={!canEdit}
                value={settings.default_invoice_due_days ?? 7}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setSettings((prev) => ({
                    ...prev,
                    default_invoice_due_days: Number.isFinite(n)
                      ? Math.min(365, Math.max(0, n))
                      : 7,
                  }));
                }}
                className="max-w-[7rem] font-mono"
              />
              <span className="text-muted-foreground text-sm">
                days after issue
              </span>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Applied to new invoices when no due date is set. Recurring series
              can override this with their own due days. Use 0 for due on the
              issue date.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Bank transfer</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Shown on the invoice portal and PDF when enabled.
            </p>
          </div>
          <Switch
            checked={settings.bank_transfer_enabled}
            disabled={!canEdit}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({
                ...prev,
                bank_transfer_enabled: checked,
              }))
            }
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="bank_account_name">Account name</Label>
            <Input
              id="bank_account_name"
              value={settings.bank_account_name ?? ''}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  bank_account_name: e.target.value || null,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="bank_sort_code">Sort code</Label>
            <Input
              id="bank_sort_code"
              value={settings.bank_sort_code ?? ''}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  bank_sort_code: e.target.value || null,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="bank_account_number">Account number</Label>
            <Input
              id="bank_account_number"
              value={settings.bank_account_number ?? ''}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  bank_account_number: e.target.value || null,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="bank_iban">IBAN (optional)</Label>
            <Input
              id="bank_iban"
              value={settings.bank_iban ?? ''}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  bank_iban: e.target.value || null,
                }))
              }
            />
          </div>
          <div>
            <Label htmlFor="bank_bic">BIC (optional)</Label>
            <Input
              id="bank_bic"
              value={settings.bank_bic ?? ''}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  bank_bic: e.target.value || null,
                }))
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bank_transfer_instructions">Instructions</Label>
            <Textarea
              id="bank_transfer_instructions"
              rows={3}
              value={settings.bank_transfer_instructions ?? ''}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  bank_transfer_instructions: e.target.value || null,
                }))
              }
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Link
          href={settingsPath.replace('/payments', '')}
          className="text-muted-foreground text-sm hover:text-[var(--workspace-shell-text)]"
        >
          ← Back to settings
        </Link>
        {canEdit ? (
          <Button
            disabled={pending}
            onClick={handleSave}
            className="bg-[var(--ozer-accent)] text-[#09111F] hover:bg-[#6BD48F]"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save payment settings
          </Button>
        ) : null}
      </div>
    </div>
  );
}
