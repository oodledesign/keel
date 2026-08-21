'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  type SopPlaybookStepRow,
  type SopRunRow,
  type SopRunStepRow,
  getSopsDb,
} from '~/lib/sops/types';

export type MessengerGuideRunSummary = {
  id: string;
  title: string;
  status: 'active' | 'completed' | 'archived';
  assistMode: boolean;
  playbookId: string;
  playbookTitle: string;
  completedSteps: number;
  totalSteps: number;
  createdAt: string;
  completedAt: string | null;
};

export type MessengerActiveGuideDetail = {
  run: SopRunRow;
  playbookTitle: string;
  steps: SopRunStepRow[];
  playbookSteps: SopPlaybookStepRow[];
};

export type MessengerGuidesPayload = {
  accountSlug: string | null;
  runs: MessengerGuideRunSummary[];
  active: MessengerActiveGuideDetail | null;
};

export const loadMessengerGuidesAction = enhanceAction(
  async (input, user): Promise<MessengerGuidesPayload> => {
    const client = getSupabaseServerClient();
    const { data: account } = await client
      .from('accounts')
      .select('slug')
      .eq('id', input.accountId)
      .maybeSingle();

    const accountSlug =
      typeof account?.slug === 'string' && account.slug.trim()
        ? account.slug.trim()
        : null;

    const db = getSopsDb();

    const { data: runs, error: runErr } = await db
      .from('runs')
      .select('*')
      .eq('account_id', input.accountId)
      .or(`started_by.eq.${user.id},assigned_to.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(25);

    if (runErr) throw new Error(runErr.message);

    const runRows = (runs ?? []) as SopRunRow[];
    const playbookIds = [...new Set(runRows.map((r) => r.playbook_id))];
    const runIds = runRows.map((r) => r.id);

    const playbookTitleById = new Map<string, string>();
    if (playbookIds.length > 0) {
      const { data: playbooks } = await db
        .from('playbooks')
        .select('id, title')
        .in('id', playbookIds);
      for (const row of playbooks ?? []) {
        const p = row as { id: string; title: string };
        playbookTitleById.set(p.id, p.title);
      }
    }

    const progressByRun = new Map<string, { done: number; total: number }>();
    if (runIds.length > 0) {
      const { data: stepRows } = await db
        .from('run_step_states')
        .select('run_id, is_complete')
        .in('run_id', runIds);

      for (const row of stepRows ?? []) {
        const s = row as { run_id: string; is_complete: boolean };
        const current = progressByRun.get(s.run_id) ?? { done: 0, total: 0 };
        current.total += 1;
        if (s.is_complete) current.done += 1;
        progressByRun.set(s.run_id, current);
      }
    }

    const summaries: MessengerGuideRunSummary[] = runRows.map((r) => {
      const progress = progressByRun.get(r.id) ?? { done: 0, total: 0 };
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        assistMode: Boolean(r.assist_mode),
        playbookId: r.playbook_id,
        playbookTitle: playbookTitleById.get(r.playbook_id) ?? 'Guide',
        completedSteps: progress.done,
        totalSteps: progress.total,
        createdAt: r.created_at,
        completedAt: r.completed_at,
      };
    });

    const activeSummary =
      summaries.find((r) => r.status === 'active' && r.assistMode) ??
      summaries.find((r) => r.status === 'active') ??
      null;

    let active: MessengerActiveGuideDetail | null = null;

    if (activeSummary) {
      const run = runRows.find((r) => r.id === activeSummary.id);
      if (run) {
        const { data: steps } = await db
          .from('run_step_states')
          .select('*')
          .eq('run_id', run.id)
          .order('position', { ascending: true });

        const stepRows = (steps ?? []) as SopRunStepRow[];
        const playbookStepIds = stepRows
          .map((s) => s.playbook_step_id)
          .filter((id): id is string => Boolean(id));

        let playbookSteps: SopPlaybookStepRow[] = [];
        if (playbookStepIds.length > 0) {
          const { data: pbSteps } = await db
            .from('playbook_steps')
            .select('*')
            .in('id', playbookStepIds);
          playbookSteps = (pbSteps ?? []) as SopPlaybookStepRow[];
        }

        active = {
          run: {
            ...run,
            assist_mode: run.assist_mode ?? true,
          },
          playbookTitle: activeSummary.playbookTitle,
          steps: stepRows,
          playbookSteps,
        };
      }
    }

    return {
      accountSlug,
      runs: summaries,
      active,
    };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
    }),
  },
);
