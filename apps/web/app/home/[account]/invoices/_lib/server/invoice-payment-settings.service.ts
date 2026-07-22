import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import type { Database } from '~/lib/database.types';

import {
  type InvoiceCurrency,
  normalizeInvoiceCurrency,
} from '../invoice-currency';
import {
  type InvoiceQuantityLabel,
  normalizeInvoiceQuantityLabel,
} from '~/lib/invoices/invoice-quantity';

export type AccountPaymentSettings = {
  account_id: string;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  bank_bic: string | null;
  bank_transfer_enabled: boolean;
  bank_transfer_instructions: string | null;
  stripe_account_id: string | null;
  stripe_connect_enabled: boolean;
  stripe_pay_now_enabled: boolean;
  invoice_starting_number: number;
  default_invoice_currency: InvoiceCurrency;
  invoice_quantity_label: InvoiceQuantityLabel;
  default_hourly_rate_pence: number | null;
};

const DEFAULT_SETTINGS: Omit<AccountPaymentSettings, 'account_id'> = {
  bank_account_name: null,
  bank_sort_code: null,
  bank_account_number: null,
  bank_iban: null,
  bank_bic: null,
  bank_transfer_enabled: false,
  bank_transfer_instructions: null,
  stripe_account_id: null,
  stripe_connect_enabled: false,
  stripe_pay_now_enabled: true,
  invoice_starting_number: 1,
  default_invoice_currency: 'gbp',
  invoice_quantity_label: 'quantity',
  default_hourly_rate_pence: null,
};

export function createInvoicePaymentSettingsService(
  client: SupabaseClient<Database>,
) {
  return new InvoicePaymentSettingsService(client);
}

class InvoicePaymentSettingsService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get db(): any {
    return this.client;
  }

  private async ensureOwnerOrAdmin(accountId: string) {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');

    const { data, error } = await this.db
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.account_role !== 'owner' && data?.account_role !== 'admin') {
      throw new Error(
        'Only account owners and admins can manage payment settings',
      );
    }
    return user;
  }

  async getSettings(accountId: string): Promise<AccountPaymentSettings> {
    const [{ data, error }, { data: counter }] = await Promise.all([
      this.db
        .from('account_payment_settings')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle(),
      this.db
        .from('invoice_counters')
        .select('next_number')
        .eq('account_id', accountId)
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);

    const nextFromCounter =
      typeof counter?.next_number === 'number' ? counter.next_number : null;

    const row = data as {
      invoice_starting_number?: number;
      default_invoice_currency?: string | null;
      invoice_quantity_label?: string | null;
      default_hourly_rate_pence?: number | null;
    } | null;

    return {
      account_id: accountId,
      ...DEFAULT_SETTINGS,
      ...(data ?? {}),
      // Prefer live counter so the UI shows the real next number after invoices exist.
      invoice_starting_number:
        nextFromCounter ??
        row?.invoice_starting_number ??
        DEFAULT_SETTINGS.invoice_starting_number,
      default_invoice_currency: normalizeInvoiceCurrency(
        row?.default_invoice_currency,
      ),
      invoice_quantity_label: normalizeInvoiceQuantityLabel(
        row?.invoice_quantity_label,
      ),
      default_hourly_rate_pence:
        typeof row?.default_hourly_rate_pence === 'number'
          ? Math.max(0, row.default_hourly_rate_pence)
          : null,
    };
  }

  async getHighestInvoiceSequence(accountId: string): Promise<number> {
    const { data, error } = await this.db
      .from('invoices')
      .select('invoice_number')
      .eq('account_id', accountId);
    if (error) throw new Error(error.message);

    let max = 0;
    for (const row of (data ?? []) as Array<{
      invoice_number?: string | null;
    }>) {
      const parsed = parseInvoiceSequence(row.invoice_number);
      if (parsed != null && parsed > max) max = parsed;
    }
    return max;
  }

  async saveSettings(input: {
    accountId: string;
    bank_account_name?: string | null;
    bank_sort_code?: string | null;
    bank_account_number?: string | null;
    bank_iban?: string | null;
    bank_bic?: string | null;
    bank_transfer_enabled?: boolean;
    bank_transfer_instructions?: string | null;
    stripe_pay_now_enabled?: boolean;
    invoice_starting_number?: number;
    default_invoice_currency?: InvoiceCurrency;
    invoice_quantity_label?: InvoiceQuantityLabel;
    default_hourly_rate_pence?: number | null;
  }) {
    await this.ensureOwnerOrAdmin(input.accountId);

    const payload = {
      account_id: input.accountId,
      ...(input.bank_account_name !== undefined
        ? { bank_account_name: input.bank_account_name }
        : {}),
      ...(input.bank_sort_code !== undefined
        ? { bank_sort_code: input.bank_sort_code }
        : {}),
      ...(input.bank_account_number !== undefined
        ? { bank_account_number: input.bank_account_number }
        : {}),
      ...(input.bank_iban !== undefined ? { bank_iban: input.bank_iban } : {}),
      ...(input.bank_bic !== undefined ? { bank_bic: input.bank_bic } : {}),
      ...(input.bank_transfer_enabled !== undefined
        ? { bank_transfer_enabled: input.bank_transfer_enabled }
        : {}),
      ...(input.bank_transfer_instructions !== undefined
        ? { bank_transfer_instructions: input.bank_transfer_instructions }
        : {}),
      ...(input.stripe_pay_now_enabled !== undefined
        ? { stripe_pay_now_enabled: input.stripe_pay_now_enabled }
        : {}),
      ...(input.invoice_starting_number !== undefined
        ? { invoice_starting_number: input.invoice_starting_number }
        : {}),
      ...(input.default_invoice_currency !== undefined
        ? {
            default_invoice_currency: normalizeInvoiceCurrency(
              input.default_invoice_currency,
            ),
          }
        : {}),
      ...(input.invoice_quantity_label !== undefined
        ? {
            invoice_quantity_label: normalizeInvoiceQuantityLabel(
              input.invoice_quantity_label,
            ),
          }
        : {}),
      ...(input.default_hourly_rate_pence !== undefined
        ? {
            default_hourly_rate_pence:
              input.default_hourly_rate_pence == null
                ? null
                : Math.max(0, input.default_hourly_rate_pence),
          }
        : {}),
    };

    const { error } = await this.db
      .from('account_payment_settings')
      .upsert(payload, { onConflict: 'account_id' })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    if (input.invoice_starting_number !== undefined) {
      await this.syncInvoiceCounter(
        input.accountId,
        input.invoice_starting_number,
      );
    }

    return this.getSettings(input.accountId);
  }

  /**
   * Sets the next allocated invoice number. Existing invoices keep their numbers.
   * The new value must be higher than any INV-#### already issued.
   */
  private async syncInvoiceCounter(accountId: string, startingNumber: number) {
    const next = Math.max(1, Math.floor(startingNumber));
    const highest = await this.getHighestInvoiceSequence(accountId);

    if (next <= highest) {
      throw new Error(
        `Next invoice number must be greater than ${highest} (highest existing invoice). Existing invoices keep their numbers; only future invoices use the new sequence.`,
      );
    }

    const { error } = await this.db.from('invoice_counters').upsert(
      {
        account_id: accountId,
        next_number: next,
      },
      { onConflict: 'account_id' },
    );
    if (error) throw new Error(error.message);
  }

  async connectStripeAccount(input: {
    accountId: string;
    stripeAccountId: string;
    stripeAccountEmail?: string | null;
  }) {
    await this.ensureOwnerOrAdmin(input.accountId);

    const { data, error } = await this.db
      .from('account_payment_settings')
      .upsert(
        {
          account_id: input.accountId,
          stripe_account_id: input.stripeAccountId,
          stripe_connect_enabled: true,
          stripe_pay_now_enabled: true,
        },
        { onConflict: 'account_id' },
      )
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as AccountPaymentSettings;
  }

  async disconnectStripe(accountId: string) {
    await this.ensureOwnerOrAdmin(accountId);

    const { data, error } = await this.db
      .from('account_payment_settings')
      .upsert(
        {
          account_id: accountId,
          stripe_account_id: null,
          stripe_connect_enabled: false,
        },
        { onConflict: 'account_id' },
      )
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as AccountPaymentSettings;
  }

  async canView(accountId: string) {
    const { data: user } = await requireUser(this.client);
    if (!user) return false;
    const api = createTeamAccountsApi(this.client);
    return api.hasPermission({
      userId: user.id,
      accountId,
      permission: 'invoices.view',
    });
  }
}

export async function loadPaymentSettingsForPortal(
  accountId: string,
): Promise<AccountPaymentSettings | null> {
  const { getSupabaseServerAdminClient } =
    await import('@kit/supabase/server-admin-client');
  const admin = getSupabaseServerAdminClient() as SupabaseClient<Database>;
  const { data, error } = await admin
    .from('account_payment_settings')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    default_invoice_currency?: string | null;
    invoice_starting_number?: number;
  } & Record<string, unknown>;
  return {
    ...DEFAULT_SETTINGS,
    ...row,
    account_id: accountId,
    default_invoice_currency: normalizeInvoiceCurrency(
      row.default_invoice_currency,
    ),
    invoice_starting_number:
      row.invoice_starting_number ?? DEFAULT_SETTINGS.invoice_starting_number,
    invoice_quantity_label: normalizeInvoiceQuantityLabel(
      row.invoice_quantity_label as string | null | undefined,
    ),
    default_hourly_rate_pence:
      typeof row.default_hourly_rate_pence === 'number'
        ? Math.max(0, row.default_hourly_rate_pence)
        : null,
  } as AccountPaymentSettings;
}

function parseInvoiceSequence(
  invoiceNumber: string | null | undefined,
): number | null {
  if (!invoiceNumber) return null;
  const match = /^INV-0*(\d+)$/i.exec(invoiceNumber.trim());
  if (!match?.[1]) return null;
  const value = parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}
