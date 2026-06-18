import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadTeamWorkspace } from '~/home/[account]/_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '~/home/[account]/_lib/server/workspace-route-guard';

import {
  getSopsDb,
  type SopPlaybookRow,
  type SopPlaybookStepRow,
  type SopRunRow,
  type SopRunStepRow,
  type SopTeamMember,
} from '~/lib/sops/types';

export type SopPlaybookListItem = SopPlaybookRow & {
  step_count: number;
  active_runs: number;
};

export type SopRunListItem = SopRunRow & {
  playbook_title: string;
  completed_steps: number;
  total_steps: number;
  assignee_name: string | null;
};

export async function loadSopTeamMembers(
  accountSlug: string,
): Promise<SopTeamMember[]> {
  const client = getSupabaseServerClient();
  const { data, error } = await client.rpc('get_account_members', {
    account_slug: accountSlug,
  });

  if (error) throw new Error(error.message);

  return (data ?? []).map(
    (row: {
      user_id: string;
      name?: string | null;
      email?: string | null;
      picture_url?: string | null;
    }) => ({
      user_id: row.user_id,
      name: row.name ?? null,
      email: row.email ?? null,
      picture_url: row.picture_url ?? null,
    }),
  );
}

function memberDisplayName(member: SopTeamMember | undefined): string | null {
  if (!member) return null;
  return member.name?.trim() || member.email?.trim() || null;
}

export const loadSopsLibraryPage = cache(async (accountSlug: string) => {
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  const accountId = workspace.account.id as string;
  const db = getSopsDb();

  const [{ data: playbooks, error: pbErr }, { data: runs, error: runErr }] =
    await Promise.all([
      db
        .from('playbooks')
        .select('*')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false }),
      db
        .from('runs')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

  if (pbErr) throw new Error(pbErr.message);
  if (runErr) throw new Error(runErr.message);

  const playbookRows = (playbooks ?? []) as SopPlaybookRow[];
  const runRows = (runs ?? []) as SopRunRow[];

  const playbookIds = playbookRows.map((p) => p.id);
  let stepCounts = new Map<string, number>();
  let activeRunCounts = new Map<string, number>();

  if (playbookIds.length > 0) {
    const [{ data: steps }, { data: activeRuns }] = await Promise.all([
      db.from('playbook_steps').select('playbook_id').in('playbook_id', playbookIds),
      db
        .from('runs')
        .select('playbook_id')
        .in('playbook_id', playbookIds)
        .eq('status', 'active'),
    ]);

    for (const row of steps ?? []) {
      const id = (row as { playbook_id: string }).playbook_id;
      stepCounts.set(id, (stepCounts.get(id) ?? 0) + 1);
    }
    for (const row of activeRuns ?? []) {
      const id = (row as { playbook_id: string }).playbook_id;
      activeRunCounts.set(id, (activeRunCounts.get(id) ?? 0) + 1);
    }
  }

  const playbookTitleById = new Map(
    playbookRows.map((p) => [p.id, p.title]),
  );

  const runIds = runRows.map((r) => r.id);
  let runProgress = new Map<string, { done: number; total: number }>();

  if (runIds.length > 0) {
    const { data: runSteps } = await db
      .from('run_step_states')
      .select('run_id, is_complete')
      .in('run_id', runIds);

    for (const row of runSteps ?? []) {
      const r = row as { run_id: string; is_complete: boolean };
      const current = runProgress.get(r.run_id) ?? { done: 0, total: 0 };
      current.total += 1;
      if (r.is_complete) current.done += 1;
      runProgress.set(r.run_id, current);
    }
  }

  const playbookList: SopPlaybookListItem[] = playbookRows.map((p) => ({
    ...p,
    step_count: stepCounts.get(p.id) ?? 0,
    active_runs: activeRunCounts.get(p.id) ?? 0,
  }));

  const members = await loadSopTeamMembers(accountSlug);
  const memberById = new Map(members.map((member) => [member.user_id, member]));

  const recentRuns: SopRunListItem[] = runRows.map((r) => {
    const progress = runProgress.get(r.id) ?? { done: 0, total: 0 };
    return {
      ...r,
      playbook_title: playbookTitleById.get(r.playbook_id) ?? 'Playbook',
      completed_steps: progress.done,
      total_steps: progress.total,
      assignee_name: memberDisplayName(
        r.assigned_to ? memberById.get(r.assigned_to) : undefined,
      ),
    };
  });

  return {
    accountId,
    accountSlug,
    playbooks: playbookList,
    recentRuns,
  };
});

export const loadSopPlaybookPage = cache(
  async (accountSlug: string, playbookId: string) => {
    const workspace = await loadTeamWorkspace(accountSlug);
    redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

    const accountId = workspace.account.id as string;
    const db = getSopsDb();

    const { data: playbook, error } = await db
      .from('playbooks')
      .select('*')
      .eq('id', playbookId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!playbook) return null;

    const [{ data: steps }, { data: runs }] = await Promise.all([
      db
        .from('playbook_steps')
        .select('*')
        .eq('playbook_id', playbookId)
        .order('position', { ascending: true }),
      db
        .from('runs')
        .select('*')
        .eq('playbook_id', playbookId)
        .order('created_at', { ascending: false })
        .limit(15),
    ]);

    return {
      accountId,
      accountSlug,
      playbook: playbook as SopPlaybookRow,
      steps: (steps ?? []) as SopPlaybookStepRow[],
      runs: (runs ?? []) as SopRunRow[],
      teamMembers: await loadSopTeamMembers(accountSlug),
    };
  },
);

export const loadSopRunPage = cache(async (accountSlug: string, runId: string) => {
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  const accountId = workspace.account.id as string;
  const db = getSopsDb();

  const { data: run, error } = await db
    .from('runs')
    .select('*')
    .eq('id', runId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!run) return null;

  const runRow = run as SopRunRow;

  const [{ data: playbook }, { data: steps }] = await Promise.all([
    db.from('playbooks').select('*').eq('id', runRow.playbook_id).maybeSingle(),
    db
      .from('run_step_states')
      .select('*')
      .eq('run_id', runId)
      .order('position', { ascending: true }),
  ]);

  return {
    accountId,
    accountSlug,
    run: runRow,
    playbook: (playbook as SopPlaybookRow | null) ?? null,
    steps: (steps ?? []) as SopRunStepRow[],
    teamMembers: await loadSopTeamMembers(accountSlug),
  };
});

export async function assertSopsSchemaAvailable(): Promise<boolean> {
  const db = getSopsDb();
  const { error } = await db.from('playbooks').select('id').limit(1);
  if (!error) return true;
  const msg = (error.message ?? '').toLowerCase();
  return !(msg.includes('schema') || msg.includes('does not exist'));
}
