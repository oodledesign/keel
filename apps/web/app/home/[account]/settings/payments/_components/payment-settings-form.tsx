'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { CreditCard, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { stripeConnectErrorMessage } from '~/lib/billing/stripe-connect-messages';

import {
  disconnectStripeAction,
  savePaymentSettingsAction,
} from '../../../invoices/_lib/server/server-actions';
import type { AccountPaymentSettings } from '../../../invoices/_lib/server/invoice-payment-settings.service';

export function PaymentSettingsForm({
  accountId,
  accountSlug,
  initialSettings,
  canEdit,
}: {
  accountId: string;
  accountSlug: string;
  initialSettings: AccountPaymentSettings;
  canEdit: boolean;
}) {
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [settings, setSettings] = useState(initialSettings);

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
        });
        setSettings(saved as AccountPaymentSettings);
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
        toast.error(error instanceof Error ? error.message : 'Disconnect failed');
      }
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 lg:px-0">
      {stripeConnectedFlash ? (
        <div className="rounded-xl border border-[var(--keel-teal)]/30 bg-[var(--keel-teal)]/10 px-4 py-3 text-sm text-[#97D9AA]">
          Stripe connected successfully. Card payments are now enabled on invoices.
        </div>
      ) : null}
      {connectError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {stripeConnectErrorMessage(connectError)}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Stripe Connect</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Accept card payments on invoices. Funds go directly to your connected
              Stripe account (destination charge, no platform fee).
            </p>
          </div>
          {stripeConnected ? (
            <span className="rounded-full border border-[var(--keel-teal)]/30 bg-[var(--keel-teal)]/10 px-2.5 py-1 text-xs font-medium text-[#97D9AA]">
              Connected
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canEdit && !stripeConnected ? (
            <Button asChild className="bg-[var(--keel-teal)] text-[#09111F] hover:bg-[#6BD48F]">
              <a
                href={`/api/stripe-connect/account-authorize?accountId=${encodeURIComponent(accountId)}`}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Connect Stripe
              </a>
            </Button>
          ) : null}
          {canEdit && stripeConnected ? (
            <Button variant="outline" disabled={pending} onClick={handleDisconnect}>
              Disconnect Stripe
            </Button>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/3 p-4">
          <div>
            <p className="text-sm font-medium">Pay by card on portal</p>
            <p className="text-xs text-muted-foreground">
              Show the Pay now button when Stripe is connected.
            </p>
          </div>
          <Switch
            checked={settings.stripe_pay_now_enabled}
            disabled={!canEdit || !stripeConnected}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, stripe_pay_now_enabled: checked }))
            }
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Bank transfer</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Shown on the invoice portal and PDF when enabled.
            </p>
          </div>
          <Switch
            checked={settings.bank_transfer_enabled}
            disabled={!canEdit}
            onCheckedChange={(checked) =>
              setSettings((prev) => ({ ...prev, bank_transfer_enabled: checked }))
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
                setSettings((prev) => ({ ...prev, bank_iban: e.target.value || null }))
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
                setSettings((prev) => ({ ...prev, bank_bic: e.target.value || null }))
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
        <Link href={settingsPath.replace('/payments', '')} className="text-sm text-muted-foreground hover:text-white">
          ← Back to settings
        </Link>
        {canEdit ? (
          <Button
            disabled={pending}
            onClick={handleSave}
            className="bg-[var(--keel-teal)] text-[#09111F] hover:bg-[#6BD48F]"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save payment settings
          </Button>
        ) : null}
      </div>
    </div>
  );
}
