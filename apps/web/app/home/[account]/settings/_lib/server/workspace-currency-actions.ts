'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { normalizeWorkspaceCurrency } from '~/lib/currency/workspace-currency';

import { saveWorkspaceCurrencySchema } from '../schema/workspace-currency.schema';
import { assertCanEditBrandSettings } from './brand-settings-access';

function workPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

export const saveWorkspaceCurrency = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertCanEditBrandSettings(
      input.accountId,
      user.id,
    );

    const currency = normalizeWorkspaceCurrency(input.default_currency);
    const admin = getSupabaseServerAdminClient();

    const { data: updatedAccount, error: accountError } = await admin
      .from('accounts')
      .update({ default_currency: currency })
      .eq('id', input.accountId)
      .select('default_currency')
      .maybeSingle();

    if (accountError) {
      throw new Error(accountError.message);
    }

    if (!updatedAccount) {
      throw new Error('Could not update workspace currency');
    }

    const { data: existingPaymentSettings } = await admin
      .from('account_payment_settings')
      .select('account_id')
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (existingPaymentSettings) {
      const { error: paymentError } = await admin
        .from('account_payment_settings')
        .update({ default_invoice_currency: currency })
        .eq('account_id', input.accountId);

      if (paymentError) {
        throw new Error(paymentError.message);
      }
    }

    revalidatePath(workPath(pathsConfig.app.accountSettings, accountSlug));
    revalidatePath(
      workPath(pathsConfig.app.accountPaymentSettings, accountSlug),
    );
    revalidatePath(workPath(pathsConfig.app.accountFinances, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountInvoices, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountProperties, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountHome, accountSlug));

    return { ok: true as const, default_currency: currency };
  },
  { schema: saveWorkspaceCurrencySchema },
);
