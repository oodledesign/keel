'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';

import { saveWorkspaceContactSettingsSchema } from '../schema/workspace-contact.schema';
import { assertCanEditBrandSettings } from './brand-settings-access';

function workPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

export const saveWorkspaceContactSettings = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertCanEditBrandSettings(
      input.accountId,
      user.id,
    );

    const admin = getSupabaseServerAdminClient();

    /**
     * Upsert only the three contact columns — ON CONFLICT leaves all other
     * brand columns (primary_color, logo_url, etc.) untouched. The DB
     * default on primary_color means a new row can be inserted without
     * explicitly providing it.
     *
     * Note: contact_email and phone were added by migration
     * 20260717180000_account_brand_contact_fields. Re-run
     * `pnpm supabase:web:typegen` to remove the type cast below once the
     * generated types include those columns.
     */
    const payload = {
      account_id: input.accountId,
      contact_email: input.contact_email?.trim() ?? null,
      phone: input.phone?.trim() ?? null,
      website_url: input.website_url?.trim() ?? null,
    };

    const { error } = await admin
      .from('account_brand_settings')
      // Type cast is temporary until typegen is re-run after the migration.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(payload as any, { onConflict: 'account_id' });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(workPath(pathsConfig.app.accountSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountBrandSettings, accountSlug));
    revalidatePath(workPath(pathsConfig.app.accountInvoices, accountSlug));

    return { ok: true as const };
  },
  { schema: saveWorkspaceContactSettingsSchema },
);
