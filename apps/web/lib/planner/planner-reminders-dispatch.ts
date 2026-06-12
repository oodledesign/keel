import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { plannerReminderClickUrl } from './reminder-sync';
import { sendWebPush } from './web-push';

type DueReminderRow = {
  id: string;
  user_id: string;
  scope_key: string;
  block_title: string;
  block_start: string;
  is_break: boolean;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function formatBlockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
}

export async function runPlannerRemindersDispatch(admin: SupabaseClient) {
  const now = new Date().toISOString();

  const { data: dueRows, error: dueError } = await admin
    .from('planner_reminders')
    .select('id, user_id, scope_key, block_title, block_start, is_break')
    .is('sent_at', null)
    .lte('notify_at', now)
    .order('notify_at', { ascending: true })
    .limit(200);

  if (dueError) throw dueError;

  const due = (dueRows ?? []) as DueReminderRow[];
  if (due.length === 0) {
    return { processed: 0, sent: 0, removedSubscriptions: 0, failed: 0 };
  }

  const userIds = [...new Set(due.map((row) => row.user_id))];
  const { data: subscriptionRows, error: subError } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (subError) throw subError;

  const subscriptionsByUser = new Map<string, SubscriptionRow[]>();
  for (const sub of (subscriptionRows ?? []) as SubscriptionRow[]) {
    const list = subscriptionsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subscriptionsByUser.set(sub.user_id, list);
  }

  let sent = 0;
  let failed = 0;
  let removedSubscriptions = 0;
  const sentReminderIds: string[] = [];
  const staleSubscriptionIds: string[] = [];

  for (const reminder of due) {
    const subscriptions = subscriptionsByUser.get(reminder.user_id) ?? [];
    if (subscriptions.length === 0) {
      sentReminderIds.push(reminder.id);
      continue;
    }

    const timeLabel = formatBlockTime(reminder.block_start);
    const payload = {
      title: reminder.is_break ? 'Break coming up' : 'Up next on your plan',
      body: timeLabel
        ? `${reminder.block_title} · ${timeLabel}`
        : reminder.block_title,
      url: plannerReminderClickUrl(reminder.scope_key),
      tag: `planner-${reminder.id}`,
    };

    let delivered = false;
    for (const subscription of subscriptions) {
      const result = await sendWebPush(subscription, payload);
      if (result === 'sent') {
        delivered = true;
        sent += 1;
      } else if (result === 'gone') {
        staleSubscriptionIds.push(subscription.id);
      } else {
        failed += 1;
      }
    }

    if (delivered || subscriptions.length === 0) {
      sentReminderIds.push(reminder.id);
    }
  }

  if (sentReminderIds.length > 0) {
    await admin
      .from('planner_reminders')
      .update({ sent_at: now, updated_at: now })
      .in('id', sentReminderIds);
  }

  if (staleSubscriptionIds.length > 0) {
    await admin
      .from('push_subscriptions')
      .delete()
      .in('id', staleSubscriptionIds);
    removedSubscriptions = staleSubscriptionIds.length;
  }

  return {
    processed: due.length,
    sent,
    failed,
    removedSubscriptions,
  };
}
