import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { notifyPhaseDueSoon } from '~/lib/jobs/project-notifications';

type DuePhaseRow = {
  id: string;
  account_id: string;
  job_id: string;
  name: string;
  due_date: string;
  jobs: { title: string | null } | { title: string | null }[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function runProjectPhaseDueReminders(admin: SupabaseClient) {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 2);
  const horizonKey = horizon.toISOString().slice(0, 10);

  const { data: phases, error } = await admin
    .from('project_phases')
    .select('id, account_id, job_id, name, due_date, jobs(title)')
    .neq('status', 'complete')
    .not('due_date', 'is', null)
    .gte('due_date', todayKey)
    .lte('due_date', horizonKey);

  if (error) {
    throw new Error(error.message);
  }

  const accountIds = Array.from(
    new Set((phases ?? []).map((row: DuePhaseRow) => row.account_id)),
  );
  const slugByAccount = new Map<string, string>();

  if (accountIds.length > 0) {
    const { data: accounts, error: accountsErr } = await admin
      .from('accounts')
      .select('id, slug')
      .in('id', accountIds);

    if (accountsErr) {
      throw new Error(accountsErr.message);
    }

    for (const account of accounts ?? []) {
      if (account.slug) slugByAccount.set(account.id, account.slug);
    }
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of (phases ?? []) as DuePhaseRow[]) {
    const dueDate = row.due_date.slice(0, 10);
    const job = firstRelation(row.jobs);
    const jobTitle = job?.title?.trim() || 'Project';
    const accountSlug = slugByAccount.get(row.account_id);

    if (!accountSlug) {
      skipped++;
      continue;
    }

    const { data: existing } = await admin
      .from('project_phase_reminder_log')
      .select('id')
      .eq('phase_id', row.id)
      .eq('due_date', dueDate)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    try {
      await notifyPhaseDueSoon({
        accountId: row.account_id,
        accountSlug,
        jobId: row.job_id,
        jobTitle,
        phaseName: row.name,
        dueDate,
      });

      const { error: logErr } = await admin
        .from('project_phase_reminder_log')
        .insert({
          account_id: row.account_id,
          phase_id: row.id,
          due_date: dueDate,
        });

      if (logErr) {
        errors.push(`${row.id}: log insert failed — ${logErr.message}`);
      } else {
        sent++;
      }
    } catch (err) {
      errors.push(
        `${row.id}: ${err instanceof Error ? err.message : 'notify failed'}`,
      );
    }
  }

  return { sent, skipped, errors };
}
