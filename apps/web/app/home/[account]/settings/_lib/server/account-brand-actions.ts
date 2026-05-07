'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { saveAccountBrandSettingsSchema } from '../schema/account-brand.schema';

function workPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

async function assertAccountOwnerOrAdmin(accountId: string, userId: string) {
  const client = getSupabaseServerClient() as SupabaseClient;
  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  const role = membership?.account_role;
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Workspace owner or admin required');
  }

  const { data: account } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  if (!account?.slug) {
    throw new Error('Account not found');
  }

  return { accountSlug: account.slug as string };
}

function uploadBrandLogoFromDataUrl(accountId: string, dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image upload');
  }

  const mimeType = match[1];
  const base64 = match[2];
  if (!mimeType || !base64) {
    throw new Error('Invalid image upload');
  }

  const ext = mimeType.includes('png')
    ? 'png'
    : mimeType.includes('webp')
      ? 'webp'
      : 'jpg';
  const path = `${accountId}/logo-${Date.now()}.${ext}`;
  const bytes = Buffer.from(base64, 'base64');
  const admin = getSupabaseServerAdminClient();

  return admin.storage
    .from('brand-assets')
    .upload(path, bytes, {
      contentType: mimeType,
      upsert: true,
    })
    .then(({ error }) => {
      if (error) {
        throw new Error(error.message);
      }
      return admin.storage.from('brand-assets').getPublicUrl(path).data.publicUrl;
    });
}

export const saveAccountBrandSettings = enhanceAction(
  async (input, user) => {
    const { accountSlug } = await assertAccountOwnerOrAdmin(
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
    } else if (input.logoDataUrl) {
      logoUrl = await uploadBrandLogoFromDataUrl(
        input.accountId,
        input.logoDataUrl,
      );
    }

    const payload = {
      account_id: input.accountId,
      primary_color: input.primary_color,
      secondary_color: input.secondary_color ?? null,
      accent_color: input.accent_color ?? null,
      logo_url: logoUrl,
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
    return { ok: true as const };
  },
  { schema: saveAccountBrandSettingsSchema },
);
