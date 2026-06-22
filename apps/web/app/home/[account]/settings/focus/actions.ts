'use server';

import { revalidatePath } from 'next/cache';

import { format } from 'date-fns';
import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import {
  getGmailVacationSettings,
  hasGmailVacationScope,
  loadGoogleConnectionMeta,
  setGmailVacationOff,
  setGmailVacationOn,
  type VacationSyncResult,
} from '~/lib/gmail/vacation-responder';

import {
  WorkspaceFocusSettingsSchema,
  type GmailVacationStatus,
  type WorkspaceFocusSettings,
} from './_lib/focus-settings.schema';

type WorkspaceFocusSettingsRow = {
  id: string;
  account_id: string;
  user_id: string;
  silence_outside_hours: boolean;
  work_days: number[];
  work_start_time: string;
  work_end_time: string;
  timezone: string;
  holiday_mode_enabled: boolean;
  holiday_mode_label: string;
  holiday_mode_until: string | null;
  ooo_enabled: boolean;
  ooo_trigger: z.infer<typeof WorkspaceFocusSettingsSchema>['ooo_trigger'];
  ooo_message: string;
  ooo_holiday_message: string | null;
  ooo_sender_name: string | null;
  ooo_cc_email: string | null;
  ooo_include_return_date: boolean;
  created_at: string;
  updated_at: string;
};

function formatTimeForClient(value: string | null | undefined): string {
  if (!value) return '09:00';
  return value.slice(0, 5);
}

function mapRowToSettings(row: WorkspaceFocusSettingsRow): WorkspaceFocusSettings {
  return {
    id: row.id,
    account_id: row.account_id,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    silence_outside_hours: row.silence_outside_hours,
    work_days: row.work_days,
    work_start_time: formatTimeForClient(row.work_start_time),
    work_end_time: formatTimeForClient(row.work_end_time),
    timezone: row.timezone,
    holiday_mode_enabled: row.holiday_mode_enabled,
    holiday_mode_label: row.holiday_mode_label,
    holiday_mode_until: row.holiday_mode_until,
    ooo_enabled: row.ooo_enabled,
    ooo_trigger: row.ooo_trigger,
    ooo_message: row.ooo_message,
    ooo_holiday_message: row.ooo_holiday_message,
    ooo_sender_name: row.ooo_sender_name,
    ooo_cc_email: row.ooo_cc_email,
    ooo_include_return_date: row.ooo_include_return_date,
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

async function revalidateFocusSettingsPage(accountId: string) {
  const client = getSupabaseServerClient();
  const { data } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();

  const slug = data?.slug as string | undefined;
  if (!slug) return;

  revalidatePath(`/home/${slug}/settings/focus`, 'page');
  revalidatePath(
    workAccountPath(pathsConfig.app.accountFocusSettings, slug),
    'page',
  );
}

export async function upsertWorkspaceFocusSettings(
  accountId: string,
  data: z.infer<typeof WorkspaceFocusSettingsSchema>,
): Promise<{ success: boolean; error?: string; gmailSyncError?: string }> {
  const parsed = WorkspaceFocusSettingsSchema.safeParse(data);

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'Invalid focus settings';
    return { success: false, error: message };
  }

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  const client = getSupabaseServerClient();
  const settings = parsed.data;
  const oooCcEmail = settings.ooo_cc_email?.trim() || null;

  const { data: existing } = await client
    .from('workspace_focus_settings')
    .select('holiday_mode_enabled')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  const previousHolidayEnabled = Boolean(
    (existing as { holiday_mode_enabled?: boolean } | null)?.holiday_mode_enabled,
  );

  const { error } = await client.from('workspace_focus_settings').upsert(
    {
      account_id: accountId,
      user_id: userId,
      silence_outside_hours: settings.silence_outside_hours,
      work_days: settings.work_days,
      work_start_time: settings.work_start_time,
      work_end_time: settings.work_end_time,
      timezone: settings.timezone,
      holiday_mode_enabled: settings.holiday_mode_enabled,
      holiday_mode_label: settings.holiday_mode_label,
      holiday_mode_until: settings.holiday_mode_until,
      ooo_enabled: settings.ooo_enabled,
      ooo_trigger: settings.ooo_trigger,
      ooo_message: settings.ooo_message,
      ooo_holiday_message: settings.ooo_holiday_message,
      ooo_sender_name: settings.ooo_sender_name,
      ooo_cc_email: oooCcEmail,
      ooo_include_return_date: settings.ooo_include_return_date,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_id,user_id' },
  );

  if (error) {
    return { success: false, error: error.message };
  }

  await revalidateFocusSettingsPage(accountId);

  if (previousHolidayEnabled !== settings.holiday_mode_enabled) {
    const gmailSync = await syncHolidayModeToGmail(accountId, userId);

    if (!gmailSync.success) {
      return {
        success: true,
        gmailSyncError: gmailSync.error ?? 'Gmail sync failed',
      };
    }
  }

  return { success: true };
}

export async function getWorkspaceFocusSettings(
  accountId: string,
): Promise<WorkspaceFocusSettings | null> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return null;
  }

  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('workspace_focus_settings')
    .select('*')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapRowToSettings(data as WorkspaceFocusSettingsRow);
}

export async function autoDisableHolidayMode(accountId: string): Promise<void> {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return;
  }

  const client = getSupabaseServerClient();
  const now = new Date().toISOString();

  const { data } = await client
    .from('workspace_focus_settings')
    .select('id, holiday_mode_enabled, holiday_mode_until')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (
    !data?.holiday_mode_enabled ||
    !data.holiday_mode_until ||
    data.holiday_mode_until >= now
  ) {
    return;
  }

  await client
    .from('workspace_focus_settings')
    .update({
      holiday_mode_enabled: false,
      holiday_mode_until: null,
      updated_at: now,
    })
    .eq('account_id', accountId)
    .eq('user_id', userId);

  const gmailSync = await setGmailVacationOff(userId);
  if (!gmailSync.success) {
    console.error('[focus] autoDisableHolidayMode Gmail sync:', gmailSync.error);
  }

  await revalidateFocusSettingsPage(accountId);
}

async function assertAuthenticatedUserId(
  userId: string,
): Promise<string | null> {
  const authenticatedUserId = await getAuthenticatedUserId();

  if (!authenticatedUserId || authenticatedUserId !== userId) {
    return null;
  }

  return authenticatedUserId;
}

function buildHolidayGmailSubject(label: string): string {
  const trimmed = label.trim();
  return trimmed
    ? `Out of Office — ${trimmed}`
    : 'Out of Office — Holiday';
}

function buildHolidayGmailMessage(
  settings: Pick<
    WorkspaceFocusSettings,
    | 'ooo_holiday_message'
    | 'ooo_message'
    | 'ooo_include_return_date'
    | 'holiday_mode_until'
  >,
): string {
  const base =
    settings.ooo_holiday_message?.trim() ||
    settings.ooo_message.trim() ||
    "I'm currently away and will reply when I'm back.";

  if (
    settings.ooo_include_return_date &&
    settings.holiday_mode_until
  ) {
    const returnDate = format(
      new Date(settings.holiday_mode_until),
      'EEEE, MMMM d, yyyy',
    );
    return `${base}\n\nI'll be back on ${returnDate}.`;
  }

  return base;
}

export async function getGmailVacationStatus(
  userId: string,
): Promise<GmailVacationStatus> {
  const authenticatedUserId = await assertAuthenticatedUserId(userId);

  if (!authenticatedUserId) {
    return 'not_connected';
  }

  const connection = await loadGoogleConnectionMeta(authenticatedUserId);

  if (!connection) {
    return 'not_connected';
  }

  if (!hasGmailVacationScope(connection.scopes)) {
    return 'scope_missing';
  }

  return getGmailVacationSettings(authenticatedUserId);
}

export async function syncHolidayModeToGmail(
  accountId: string,
  userId: string,
): Promise<VacationSyncResult> {
  const authenticatedUserId = await assertAuthenticatedUserId(userId);

  if (!authenticatedUserId) {
    return {
      success: false,
      error: 'Not authenticated',
    };
  }

  const settings = await getWorkspaceFocusSettings(accountId);

  if (!settings) {
    return {
      success: false,
      error: 'Focus settings not found',
    };
  }

  if (settings.holiday_mode_enabled) {
    const endDate = settings.holiday_mode_until
      ? new Date(settings.holiday_mode_until)
      : null;

    return setGmailVacationOn(
      authenticatedUserId,
      buildHolidayGmailMessage(settings),
      buildHolidayGmailSubject(settings.holiday_mode_label),
      endDate,
      settings.ooo_sender_name,
    );
  }

  return setGmailVacationOff(authenticatedUserId);
}

export async function turnOffGmailVacationResponder(
  userId: string,
): Promise<VacationSyncResult> {
  const authenticatedUserId = await assertAuthenticatedUserId(userId);

  if (!authenticatedUserId) {
    return {
      success: false,
      error: 'Not authenticated',
    };
  }

  return setGmailVacationOff(authenticatedUserId);
}
