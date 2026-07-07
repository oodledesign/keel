import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  WorkspaceFocusInput,
  WorkspaceSchedulingSettings,
} from '~/lib/workspace-focus';
import { resolveWorkspaceSchedulingSettings } from '~/lib/workspace-focus';

const FOCUS_SETTINGS_COLUMNS =
  'account_id, silence_outside_hours, work_days, work_start_time, work_end_time, timezone, holiday_mode_enabled, holiday_mode_label, holiday_mode_until, ooo_enabled, ooo_trigger, ooo_message, ooo_holiday_message, ooo_sender_name, ooo_cc_email, ooo_include_return_date';

type FocusSettingsRow = WorkspaceFocusInput & {
  account_id: string;
  work_start_time: string;
  work_end_time: string;
};

function formatTimeForClient(value: string | null | undefined): string {
  if (!value) return '09:00';
  return value.slice(0, 5);
}

function mapRow(row: FocusSettingsRow): WorkspaceFocusInput {
  return {
    account_id: row.account_id,
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

export async function loadWorkspaceFocusSettingsMap(
  client: SupabaseClient,
  userId: string,
  accountIds?: string[],
): Promise<Map<string, WorkspaceFocusInput>> {
  let query = client
    .from('workspace_focus_settings')
    .select(FOCUS_SETTINGS_COLUMNS)
    .eq('user_id', userId);

  if (accountIds?.length) {
    query = query.in('account_id', accountIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[workspace-focus] load settings:', error.message);
    return new Map();
  }

  const map = new Map<string, WorkspaceFocusInput>();

  for (const row of (data ?? []) as FocusSettingsRow[]) {
    map.set(row.account_id, mapRow(row));
  }

  return map;
}

export async function loadWorkspaceFocusSettingsForAccount(
  client: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<WorkspaceFocusInput | null> {
  const map = await loadWorkspaceFocusSettingsMap(client, userId, [accountId]);
  return map.get(accountId) ?? null;
}

export async function loadWorkspaceSchedulingSettingsForUser(
  client: SupabaseClient,
  accountId: string,
  userId: string,
): Promise<WorkspaceSchedulingSettings> {
  const settings = await loadWorkspaceFocusSettingsForAccount(
    client,
    userId,
    accountId,
  );

  return resolveWorkspaceSchedulingSettings(settings);
}
