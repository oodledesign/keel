'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';

import { formValuesToSettings } from './_lib/activity-privacy-form';
import {
  ActivityPrivacyFormSchema,
  type ActivityPrivacySettings,
} from './_lib/activity-privacy-settings.schema';

type ActivityPrivacySettingsRow = {
  account_id: string;
  user_id: string;
  excluded_apps: string[];
  excluded_domains: string[];
  tracking_enabled: boolean;
  capture_full_urls: boolean;
  idle_threshold_seconds: number;
  created_at: string;
  updated_at: string;
};

function mapRowToSettings(
  row: ActivityPrivacySettingsRow,
): ActivityPrivacySettings {
  return {
    account_id: row.account_id,
    user_id: row.user_id,
    excluded_apps: row.excluded_apps ?? [],
    excluded_domains: row.excluded_domains ?? [],
    tracking_enabled: row.tracking_enabled,
    capture_full_urls: row.capture_full_urls,
    idle_threshold_seconds: row.idle_threshold_seconds,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getAuthenticatedUserId(): Promise<string | null> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

async function revalidateActivityPrivacySettingsPage(accountId: string) {
  const client = getSupabaseServerClient();
  const { data } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  const slug = data?.slug as string | undefined;
  if (!slug) return;

  revalidatePath(`/home/${slug}/settings/activity`, 'page');
  revalidatePath(
    workAccountPath(pathsConfig.app.accountActivityPrivacySettings, slug),
    'page',
  );
}

export async function getActivityPrivacySettings(
  accountId: string,
): Promise<ActivityPrivacySettings | null> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return null;
  }

  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('activity_privacy_settings')
    .select('*')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapRowToSettings(data as ActivityPrivacySettingsRow);
}

export async function upsertActivityPrivacySettings(
  accountId: string,
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const parsed = ActivityPrivacyFormSchema.safeParse(data);

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'Invalid activity privacy settings';
    return { success: false, error: message };
  }

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  const settings = formValuesToSettings(parsed.data);
  const client = getSupabaseServerClient();

  const { error } = await client.from('activity_privacy_settings').upsert(
    {
      account_id: accountId,
      user_id: userId,
      tracking_enabled: settings.tracking_enabled,
      capture_full_urls: settings.capture_full_urls,
      idle_threshold_seconds: settings.idle_threshold_seconds,
      excluded_apps: settings.excluded_apps,
      excluded_domains: settings.excluded_domains,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_id,user_id' },
  );

  if (error) {
    return { success: false, error: error.message };
  }

  await revalidateActivityPrivacySettingsPage(accountId);

  return { success: true };
}
