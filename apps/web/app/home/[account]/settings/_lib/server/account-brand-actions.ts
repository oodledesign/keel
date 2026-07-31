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

    const payload = {
      account_id: input.accountId,
      primary_color: input.primary_color,
      secondary_color: input.secondary_color ?? null,
      accent_color: input.accent_color ?? null,
      logo_url: (existing?.logo_url as string | null) ?? null,
      website_url: input.website_url?.trim() || null,
      address: input.address?.trim() || null,
    };

    const { error } = await admin
      .from('account_brand_settings')
      .upsert(payload, {
        onConflict: 'account_id',
      });

    if (error) {
      throw new Error(error.message);
    }

    if (input.portal_slug !== undefined) {
      const portalSlug = input.portal_slug?.trim().toLowerCase() || null;

      if (portalSlug) {
        const { data: taken } = await admin
          .from('agency_branding')
          .select('business_id')
          .eq('slug', portalSlug)
          .neq('business_id', input.accountId)
          .maybeSingle();

        if (taken) {
          throw new Error('That portal slug is already taken');
        }
      }

      const { data: account } = await admin
        .from('accounts')
        .select('name, picture_url')
        .eq('id', input.accountId)
        .maybeSingle();

      const { data: existingAgency } = await admin
        .from('agency_branding')
        .select('id, logo_url')
        .eq('business_id', input.accountId)
        .maybeSingle();

      const agencyPayload = {
        business_id: input.accountId,
        slug: portalSlug,
        brand_name: (account?.name as string | null) ?? null,
        primary_colour: input.primary_color,
        logo_url:
          ((existingAgency?.logo_url as string | null) ??
            (account?.picture_url as string | null) ??
            payload.logo_url) ||
          null,
      };

      const { error: agencyError } = existingAgency
        ? await admin
            .from('agency_branding')
            .update(agencyPayload)
            .eq('business_id', input.accountId)
        : await admin.from('agency_branding').insert(agencyPayload);

      if (agencyError) {
        if (agencyError.code === '23505') {
          throw new Error('That portal slug is already taken');
        }
        throw new Error(agencyError.message);
      }
    }

    revalidatePath(workPath(pathsConfig.app.accountSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountBrandSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountInvoices, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountClients, accountSlug));
    revalidatePath(
      workPath(pathsConfig.app.accountSignaturesDashboard, accountSlug),
    );
    return { ok: true as const };
  },
  { schema: saveAccountBrandSettingsSchema },
);
