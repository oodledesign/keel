'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';

import { saveAccountBrandSettingsSchema } from '../schema/account-brand.schema';
import { assertCanEditBrandSettings } from './brand-settings-access';

function workPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

export const saveAccountBrandSettings = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertCanEditBrandSettings(
      input.accountId,
      user.id,
    );

    const admin = getSupabaseServerAdminClient();
    const { data: existing } = await admin
      .from('account_brand_settings')
      .select('logo_url')
      .eq('account_id', input.accountId)
      .maybeSingle();

    let logoUrl: string | null = (existing?.logo_url as string | null) ?? null;
    if (input.clearLogo) {
      logoUrl = null;
    } else if (input.logoUrl) {
      logoUrl = input.logoUrl;
    }

    const payload = {
      account_id: input.accountId,
      primary_color: input.primary_color,
      secondary_color: input.secondary_color ?? null,
      accent_color: input.accent_color ?? null,
      logo_url: logoUrl,
      website_url: input.website_url?.trim() || null,
      address: input.address?.trim() || null,
    };

    const { error } = await admin.from('account_brand_settings').upsert(payload, {
      onConflict: 'account_id',
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(workPath(pathsConfig.app.accountSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountBrandSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountInvoices, accountSlug));
    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug),
    );
    return { ok: true as const };
  },
  { schema: saveAccountBrandSettingsSchema },
);
