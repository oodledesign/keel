'use server';

import { enhanceAction } from '@kit/next/actions';
import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { generateInvoiceDraftFromPrompt } from '~/lib/ai/invoice-generate';
import { isInsufficientCreditsError } from '~/lib/ai/router';
import { normalizePence } from '~/lib/invoices/invoice-quantity';

import {
  invoiceCurrencySymbol,
  normalizeInvoiceCurrency,
} from '../invoice-currency';
import { GenerateInvoiceLineItemsSchema } from '../schema/invoice-ai.schema';
import { createInvoicesService } from './invoices.service';

export const generateInvoiceLineItemsAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { data: user } = await requireUser(client);
    if (!user) throw new Error('Authentication required');

    const api = createTeamAccountsApi(client);
    const hasPermission = await api.hasPermission({
      userId: user.id,
      accountId: input.accountId,
      permission: 'invoices.edit',
    });
    if (!hasPermission) throw new Error('Permission denied');

    const invoices = createInvoicesService(client);
    const invoice = await invoices.getInvoice({
      accountId: input.accountId,
      invoiceId: input.invoiceId,
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== 'draft') {
      throw new Error('Only draft invoices can be generated with AI');
    }

    const currency = normalizeInvoiceCurrency(
      input.currency ?? invoice.currency,
    );

    const clientRow = invoice.client as {
      display_name?: string | null;
      company_name?: string | null;
    } | null;
    const clientName =
      clientRow?.display_name?.trim() ||
      clientRow?.company_name?.trim() ||
      null;

    const { data: paymentSettings } = await client
      .from('account_payment_settings')
      .select('default_hourly_rate_pence')
      .eq('account_id', input.accountId)
      .maybeSingle();

    const defaultHourlyRatePence = normalizePence(
      paymentSettings?.default_hourly_rate_pence,
    );

    try {
      return await generateInvoiceDraftFromPrompt({
        prompt: input.prompt,
        currency: currency.toUpperCase(),
        currencySymbol: invoiceCurrencySymbol(currency),
        clientName,
        defaultHourlyRatePence,
        accountId: input.accountId,
        supabase: client,
      });
    } catch (error) {
      if (isInsufficientCreditsError(error)) {
        throw new Error(
          `${error.message}. Purchase more AI credits to continue.`,
        );
      }
      throw error;
    }
  },
  { schema: GenerateInvoiceLineItemsSchema },
);
