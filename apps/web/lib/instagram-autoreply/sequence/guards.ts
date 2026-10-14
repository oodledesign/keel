import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { assertIgSendAllowed } from '~/lib/billing/entitlements';

import { getIgHourlySendCap } from '../env';

export type SendCapResult =
  | { ok: true }
  | { ok: false; reason: 'hourly_cap'; retryAt: Date };

export type IgPlanSendBudget =
  | { ok: true; hourlyCap: number; remainingThisMonth: number | null }
  | { ok: false; reason: string };

function startOfUtcMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Plan limits for automated sends: the monthly cap and hourly cap override. */
export async function loadIgPlanSendBudget(
  admin: SupabaseClient,
  accountId: string,
  now: Date = new Date(),
): Promise<IgPlanSendBudget> {
  const result = await assertIgSendAllowed(admin, accountId, async () => {
    const { count } = await admin
      .from('ig_message_events')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('direction', 'outbound')
      .in('event_type', ['step', 'private_reply'])
      .in('send_status', ['sent', 'queued'])
      .gte('created_at', startOfUtcMonth(now).toISOString());
    return count ?? 0;
  });

  if (!result.allowed) {
    return {
      ok: false,
      reason: result.reason ?? 'Monthly Instagram send limit reached',
    };
  }
  return {
    ok: true,
    hourlyCap:
      result.hourlyCap && result.hourlyCap > 0
        ? result.hourlyCap
        : getIgHourlySendCap(),
    remainingThisMonth: result.remainingThisMonth,
  };
}

/**
 * Per connected account hourly cap on automated sends. Over the cap, runs are
 * deferred (not failed) so nothing is lost.
 */
export async function checkHourlySendCap(
  admin: SupabaseClient,
  igAccountId: string,
  now: Date = new Date(),
  cap: number = getIgHourlySendCap(),
): Promise<SendCapResult> {
  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from('ig_message_events')
    .select('id', { count: 'exact', head: true })
    .eq('ig_account_id', igAccountId)
    .eq('direction', 'outbound')
    .eq('send_status', 'sent')
    .gte('created_at', since);

  if (error) return { ok: true };

  if ((count ?? 0) >= cap) {
    return {
      ok: false,
      reason: 'hourly_cap',
      retryAt: new Date(now.getTime() + 10 * 60 * 1000),
    };
  }
  return { ok: true };
}

/** once_per_contact: has this contact already had a run for the trigger? */
export async function hasPriorRun(
  admin: SupabaseClient,
  triggerId: string,
  contactId: string,
): Promise<boolean> {
  const { count } = await admin
    .from('ig_automation_runs')
    .select('id', { count: 'exact', head: true })
    .eq('trigger_id', triggerId)
    .eq('contact_id', contactId);
  return (count ?? 0) > 0;
}

/** cooldown_minutes: was a run for this trigger + contact started recently? */
export async function isInCooldown(
  admin: SupabaseClient,
  params: {
    triggerId: string;
    contactId: string;
    cooldownMinutes: number | null;
    now?: Date;
  },
): Promise<boolean> {
  if (!params.cooldownMinutes || params.cooldownMinutes <= 0) return false;
  const now = params.now ?? new Date();
  const since = new Date(
    now.getTime() - params.cooldownMinutes * 60_000,
  ).toISOString();
  const { count } = await admin
    .from('ig_automation_runs')
    .select('id', { count: 'exact', head: true })
    .eq('trigger_id', params.triggerId)
    .eq('contact_id', params.contactId)
    .gte('created_at', since);
  return (count ?? 0) > 0;
}
