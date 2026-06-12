import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';

import { parseDayScheduleFromMarkdown } from './parse-plan-markdown';

type PushSettingsRow = {
  enabled: boolean;
  lead_minutes: number;
};

export type SyncPlannerRemindersResult = {
  synced: number;
  cleared: boolean;
};

function dayViewPath(scopeKey: string): string {
  if (scopeKey === 'personal') {
    return pathsConfig.app.personalPlannerDay;
  }
  const slug = scopeKey.slice('workspace:'.length);
  return pathsConfig.app.accountPlannerDay.replace('[account]', slug);
}

export function plannerReminderClickUrl(scopeKey: string): string {
  return dayViewPath(scopeKey);
}

/**
 * Rebuild unsent reminder rows for a saved day plan. Called after plan persistence.
 */
export async function syncPlannerRemindersForPlan(
  client: SupabaseClient,
  userId: string,
  scopeKey: string,
  planDate: string,
  markdown: string,
  mode: 'day' | 'week',
): Promise<SyncPlannerRemindersResult> {
  const clearUnsent = async () => {
    await client
      .from('planner_reminders')
      .delete()
      .eq('user_id', userId)
      .eq('scope_key', scopeKey)
      .eq('plan_date', planDate)
      .is('sent_at', null);
  };

  if (mode !== 'day') {
    await clearUnsent();
    return { synced: 0, cleared: true };
  }

  const { data: settingsRow } = await client
    .from('planner_push_settings')
    .select('enabled, lead_minutes')
    .eq('user_id', userId)
    .maybeSingle();

  const settings = settingsRow as PushSettingsRow | null;
  if (!settings?.enabled) {
    await clearUnsent();
    return { synced: 0, cleared: true };
  }

  const { count: subscriptionCount } = await client
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (!subscriptionCount) {
    await clearUnsent();
    return { synced: 0, cleared: true };
  }

  const leadMinutes = settings.lead_minutes ?? 10;
  const dateIso = `${planDate}T12:00:00`;
  const blocks = parseDayScheduleFromMarkdown(markdown, dateIso).filter(
    (block) => !block.isCalendarEvent,
  );

  const nowMs = Date.now();
  const rows = blocks
    .map((block) => {
      const startMs = new Date(block.start).getTime();
      if (!Number.isFinite(startMs) || startMs <= nowMs) return null;

      const notifyAt = new Date(startMs - leadMinutes * 60 * 1000);
      if (notifyAt.getTime() <= nowMs) return null;

      return {
        user_id: userId,
        scope_key: scopeKey,
        plan_date: planDate,
        block_start: block.start,
        block_end: block.end,
        block_title: block.title,
        is_break: block.isBreak,
        notify_at: notifyAt.toISOString(),
        sent_at: null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  await clearUnsent();

  if (rows.length === 0) {
    return { synced: 0, cleared: true };
  }

  const { error } = await client.from('planner_reminders').upsert(rows, {
    onConflict: 'user_id,scope_key,plan_date,block_start',
  });

  if (error) throw error;

  return { synced: rows.length, cleared: true };
}

/** Re-sync today's saved plan after the user enables push reminders. */
export async function resyncTodayPlannerReminders(
  client: SupabaseClient,
  userId: string,
): Promise<SyncPlannerRemindersResult> {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const planDate = `${y}-${m}-${d}`;

  const { data: plans } = await client
    .from('planner_plans')
    .select('scope_key, markdown, mode')
    .eq('user_id', userId)
    .eq('plan_date', planDate)
    .eq('mode', 'day');

  let totalSynced = 0;
  for (const plan of plans ?? []) {
    const row = plan as {
      scope_key: string;
      markdown: string;
      mode: 'day' | 'week';
    };
    const result = await syncPlannerRemindersForPlan(
      client,
      userId,
      row.scope_key,
      planDate,
      row.markdown,
      row.mode,
    );
    totalSynced += result.synced;
  }

  return { synced: totalSynced, cleared: totalSynced >= 0 };
}
