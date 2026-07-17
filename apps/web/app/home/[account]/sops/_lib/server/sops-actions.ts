'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { extractSopPlaybookFromText } from '~/lib/ai/sop-import';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import {
  defaultPeriodLabel,
  defaultRunTitle,
  getSopsDb,
} from '~/lib/sops/types';

const RecurrenceSchema = z.enum(['monthly', 'weekly', 'project', 'ad_hoc']);

const StepInputSchema = z.object({
  title: z.string().min(1).max(500),
  body_md: z.string().max(20000).optional().nullable(),
});

function sopsBasePath(slug: string) {
  return pathsConfig.app.accountSops.replace('[account]', slug);
}

function playbookPath(slug: string, playbookId: string) {
  return pathsConfig.app.accountSopsPlaybook
    .replace('[account]', slug)
    .replace('[playbookId]', playbookId);
}

function runPath(slug: string, runId: string) {
  return pathsConfig.app.accountSopsRun
    .replace('[account]', slug)
    .replace('[runId]', runId);
}

async function assertTeamMember(accountSlug: string, userId: string) {
  const client = getSupabaseServerClient();
  const { data, error } = await client.rpc('get_account_members', {
    account_slug: accountSlug,
  });

  if (error) throw error;

  const isMember = (data ?? []).some(
    (row: { user_id: string }) => row.user_id === userId,
  );

  if (!isMember) {
    throw new Error('Selected user is not a team member in this workspace');
  }
}

export const importSopFromTextAction = enhanceAction(
  async (data) => {
    const draft = await extractSopPlaybookFromText(data.rawText);
    return { draft };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      rawText: z.string().min(20).max(120_000),
    }),
  },
);

export const createSopPlaybookAction = enhanceAction(
  async (data) => {
    const user = await requireUserInServerComponent();
    const db = getSopsDb();

    const { data: playbook, error } = await db
      .from('playbooks')
      .insert({
        account_id: data.accountId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        category: data.category?.trim() || null,
        recurrence: data.recurrence,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) throw error;

    const playbookId = (playbook as { id: string }).id;

    if (data.steps.length > 0) {
      const { error: stepsErr } = await db.from('playbook_steps').insert(
        data.steps.map((step, index) => ({
          playbook_id: playbookId,
          position: index,
          title: step.title.trim(),
          body_md: step.body_md?.trim() || null,
        })),
      );
      if (stepsErr) throw stepsErr;
    }

    revalidatePath(sopsBasePath(data.accountSlug));
    return { playbookId };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      title: z.string().min(1).max(300),
      description: z.string().max(5000).optional().nullable(),
      category: z.string().max(200).optional().nullable(),
      recurrence: RecurrenceSchema,
      steps: z.array(StepInputSchema).min(1),
    }),
  },
);

export const startSopRunAction = enhanceAction(
  async (data) => {
    const user = await requireUserInServerComponent();
    const db = getSopsDb();

    const { data: playbook, error: pbErr } = await db
      .from('playbooks')
      .select('id, title, recurrence, account_id')
      .eq('id', data.playbookId)
      .eq('account_id', data.accountId)
      .maybeSingle();

    if (pbErr) throw pbErr;
    if (!playbook) throw new Error('Playbook not found');

    const pb = playbook as {
      id: string;
      title: string;
      recurrence: z.infer<typeof RecurrenceSchema>;
    };

    const { data: templateSteps, error: stepsErr } = await db
      .from('playbook_steps')
      .select('id, position, title, body_md')
      .eq('playbook_id', data.playbookId)
      .order('position', { ascending: true });

    if (stepsErr) throw stepsErr;
    if (!templateSteps?.length) {
      throw new Error(
        'Add at least one step to this playbook before starting a run.',
      );
    }

    const title =
      data.title?.trim() || defaultRunTitle(pb.title, pb.recurrence);
    const periodLabel =
      data.periodLabel?.trim() || defaultPeriodLabel(pb.recurrence);

    if (data.assignedToUserId) {
      await assertTeamMember(data.accountSlug, data.assignedToUserId);
    }

    const { data: run, error: runErr } = await db
      .from('runs')
      .insert({
        account_id: data.accountId,
        playbook_id: data.playbookId,
        title,
        period_label: periodLabel,
        notes_md: data.notesMd?.trim() || null,
        started_by: user.id,
        assigned_to: data.assignedToUserId ?? null,
        status: 'active',
      })
      .select('id')
      .single();

    if (runErr) throw runErr;

    const runId = (run as { id: string }).id;

    const { error: stateErr } = await db.from('run_step_states').insert(
      (
        templateSteps as Array<{
          id: string;
          position: number;
          title: string;
          body_md: string | null;
        }>
      ).map((step) => ({
        run_id: runId,
        playbook_step_id: step.id,
        position: step.position,
        title: step.title,
        body_md: step.body_md,
        is_complete: false,
      })),
    );

    if (stateErr) throw stateErr;

    revalidatePath(sopsBasePath(data.accountSlug));
    revalidatePath(playbookPath(data.accountSlug, data.playbookId));

    return { runId };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      playbookId: z.string().uuid(),
      title: z.string().max(300).optional(),
      periodLabel: z.string().max(200).optional(),
      notesMd: z.string().max(20_000).optional(),
      assignedToUserId: z.string().uuid().optional(),
    }),
  },
);

export const updateSopRunAssigneeAction = enhanceAction(
  async (data) => {
    const db = getSopsDb();

    if (data.assignedToUserId) {
      await assertTeamMember(data.accountSlug, data.assignedToUserId);
    }

    const { error } = await db
      .from('runs')
      .update({ assigned_to: data.assignedToUserId ?? null })
      .eq('id', data.runId)
      .eq('account_id', data.accountId);

    if (error) throw error;

    revalidatePath(runPath(data.accountSlug, data.runId));
    revalidatePath(sopsBasePath(data.accountSlug));
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      runId: z.string().uuid(),
      assignedToUserId: z.string().uuid().nullable().optional(),
    }),
  },
);

export const duplicateSopRunAction = enhanceAction(
  async (data) => {
    const user = await requireUserInServerComponent();
    const db = getSopsDb();

    const page = await db
      .from('runs')
      .select('*')
      .eq('id', data.runId)
      .eq('account_id', data.accountId)
      .maybeSingle();

    if (page.error) throw page.error;
    if (!page.data) throw new Error('Run not found');

    const source = page.data as {
      playbook_id: string;
      title: string;
      period_label: string | null;
      notes_md: string | null;
      assigned_to: string | null;
    };

    const { data: playbook } = await db
      .from('playbooks')
      .select('title, recurrence')
      .eq('id', source.playbook_id)
      .maybeSingle();

    const pb = playbook as {
      title: string;
      recurrence: z.infer<typeof RecurrenceSchema>;
    } | null;

    const title =
      data.title?.trim() ||
      (pb
        ? defaultRunTitle(pb.title, pb.recurrence)
        : `${source.title} (copy)`);

    const { data: run, error: runErr } = await db
      .from('runs')
      .insert({
        account_id: data.accountId,
        playbook_id: source.playbook_id,
        title,
        period_label:
          data.periodLabel?.trim() ||
          (pb ? defaultPeriodLabel(pb.recurrence) : source.period_label),
        notes_md: source.notes_md,
        started_by: user.id,
        assigned_to: source.assigned_to,
        status: 'active',
      })
      .select('id')
      .single();

    if (runErr) throw runErr;

    const runId = (run as { id: string }).id;

    const { data: sourceSteps, error: stepsErr } = await db
      .from('run_step_states')
      .select('playbook_step_id, position, title, body_md')
      .eq('run_id', data.runId)
      .order('position', { ascending: true });

    if (stepsErr) throw stepsErr;

    const { error: insertErr } = await db.from('run_step_states').insert(
      (sourceSteps ?? []).map(
        (step: {
          playbook_step_id: string | null;
          position: number;
          title: string;
          body_md: string | null;
        }) => ({
          run_id: runId,
          playbook_step_id: step.playbook_step_id,
          position: step.position,
          title: step.title,
          body_md: step.body_md,
          is_complete: false,
        }),
      ),
    );

    if (insertErr) throw insertErr;

    revalidatePath(sopsBasePath(data.accountSlug));
    return { runId };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      runId: z.string().uuid(),
      title: z.string().max(300).optional(),
      periodLabel: z.string().max(200).optional(),
    }),
  },
);

export const updateSopRunNotesAction = enhanceAction(
  async (data) => {
    const db = getSopsDb();
    const { error } = await db
      .from('runs')
      .update({ notes_md: data.notesMd?.trim() || null })
      .eq('id', data.runId)
      .eq('account_id', data.accountId);

    if (error) throw error;

    revalidatePath(runPath(data.accountSlug, data.runId));
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      runId: z.string().uuid(),
      notesMd: z.string().max(50_000).optional().nullable(),
    }),
  },
);

export const toggleSopRunStepAction = enhanceAction(
  async (data) => {
    const user = await requireUserInServerComponent();
    const db = getSopsDb();

    const { data: step, error: fetchErr } = await db
      .from('run_step_states')
      .select('id, run_id')
      .eq('id', data.stepStateId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!step) throw new Error('Step not found');

    const isComplete = data.isComplete;
    const { error } = await db
      .from('run_step_states')
      .update({
        is_complete: isComplete,
        completed_at: isComplete ? new Date().toISOString() : null,
        completed_by: isComplete ? user.id : null,
        step_notes: data.stepNotes?.trim() || null,
      })
      .eq('id', data.stepStateId);

    if (error) throw error;

    const runId = (step as { run_id: string }).run_id;

    const { data: allSteps } = await db
      .from('run_step_states')
      .select('is_complete')
      .eq('run_id', runId);

    const rows = allSteps ?? [];
    const allDone =
      rows.length > 0 &&
      rows.every((r) => (r as { is_complete: boolean }).is_complete);

    await db
      .from('runs')
      .update({
        status: allDone ? 'completed' : 'active',
        completed_at: allDone ? new Date().toISOString() : null,
      })
      .eq('id', runId)
      .eq('account_id', data.accountId);

    revalidatePath(runPath(data.accountSlug, runId));
    return { ok: true, allDone };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      stepStateId: z.string().uuid(),
      isComplete: z.boolean(),
      stepNotes: z.string().max(5000).optional().nullable(),
    }),
  },
);

export const updateSopPlaybookAction = enhanceAction(
  async (data) => {
    const db = getSopsDb();

    const { error: pbErr } = await db
      .from('playbooks')
      .update({
        title: data.title.trim(),
        description: data.description?.trim() || null,
        category: data.category?.trim() || null,
        recurrence: data.recurrence,
      })
      .eq('id', data.playbookId)
      .eq('account_id', data.accountId);

    if (pbErr) throw pbErr;

    await db.from('playbook_steps').delete().eq('playbook_id', data.playbookId);

    if (data.steps.length > 0) {
      const { error: stepsErr } = await db.from('playbook_steps').insert(
        data.steps.map((step, index) => ({
          playbook_id: data.playbookId,
          position: index,
          title: step.title.trim(),
          body_md: step.body_md?.trim() || null,
        })),
      );
      if (stepsErr) throw stepsErr;
    }

    revalidatePath(playbookPath(data.accountSlug, data.playbookId));
    revalidatePath(sopsBasePath(data.accountSlug));
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      playbookId: z.string().uuid(),
      title: z.string().min(1).max(300),
      description: z.string().max(5000).optional().nullable(),
      category: z.string().max(200).optional().nullable(),
      recurrence: RecurrenceSchema,
      steps: z.array(StepInputSchema).min(1),
    }),
  },
);
