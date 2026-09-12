import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { notifyJobTaskAssigned } from '~/lib/jobs/project-notifications';
import { buildTaskNotesFromSource } from '~/lib/tasks/build-task-notes-from-source';
import { clampDurationMinutes } from '~/lib/tasks/task-duration';

import type { RetainerMatchKind } from './constants';
import {
  consumeProjectRetainerCredits,
  restoreProjectRetainerCredits,
} from './credit-ledger';
import { isUndoWindowOpen } from './credit-rules';
import { looseClient } from './loose-client';
import { mapMatchSuggestion, mapRetainerService } from './map-records';

function db(client: SupabaseClient) {
  return looseClient(client);
}

async function insertEmailTask(
  client: SupabaseClient,
  input: {
    userId: string;
    title: string;
    detail: string | null;
    sourceExcerpt: string | null;
    dueDate: string | null;
    durationMinutes: number | null;
    projectId: string | null;
    clientId: string | null;
    accountId: string | null;
    status: string;
    assigneeUserId: string;
    retainerServiceId: string | null;
    creditsBurned: number | null;
    creditsBurnedAt: string | null;
    emailThreadId: string | null;
  },
): Promise<string> {
  const insertRow: Record<string, unknown> = {
    user_id: input.assigneeUserId,
    title: input.title,
    notes: buildTaskNotesFromSource({
      description: input.detail,
      sourceExcerpt: input.sourceExcerpt,
      sourceLabel: 'Email',
    }),
    due_date: input.dueDate,
    duration_minutes: clampDurationMinutes(input.durationMinutes),
    project_id: input.projectId,
    client_id: input.clientId,
    account_id: input.accountId,
    status: input.status,
    priority: 'medium',
    source: 'email',
    retainer_service_id: input.retainerServiceId,
    credits_burned: input.creditsBurned,
    credits_burned_at: input.creditsBurnedAt,
    retainer_email_thread_id: input.emailThreadId,
  };

  let result = await db(client)
    .from('tasks')
    .insert(insertRow)
    .select('id')
    .single();

  if (result.error?.message?.includes('source')) {
    const { source: _source, ...withoutSource } = insertRow;
    void _source;
    result = await db(client)
      .from('tasks')
      .insert(withoutSource)
      .select('id')
      .single();
  }

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? 'Could not create task');
  }

  return String((result.data as { id: string }).id);
}

export async function applyRetainerMatch(input: {
  admin: SupabaseClient;
  suggestionId: string;
  mode: 'apply' | 'auto' | 'skip';
  actorUserId: string;
  serviceId?: string | null;
  addServiceToProject?: boolean;
}): Promise<{ taskId: string; burned: number }> {
  const { data: suggestionRow, error } = await db(input.admin)
    .from('retainer_match_suggestions')
    .select('*')
    .eq('id', input.suggestionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!suggestionRow) throw new Error('Match suggestion not found');

  const suggestion = mapMatchSuggestion(
    suggestionRow as Record<string, unknown>,
  );
  if (suggestion.status !== 'pending') {
    throw new Error('This match is no longer pending');
  }

  const { data: actionItem, error: actionError } = suggestion.emailActionItemId
    ? await db(input.admin)
        .from('email_action_items')
        .select(
          'id, title, detail, source_excerpt, suggested_due_date, suggested_duration_minutes, suggested_assignee_id, user_id, thread_id, account_id, client_id, project_id, status',
        )
        .eq('id', suggestion.emailActionItemId)
        .maybeSingle()
    : { data: null, error: null };

  if (actionError) throw new Error(actionError.message);
  if (!actionItem || actionItem.status !== 'suggested') {
    throw new Error('The email suggestion is no longer available');
  }

  const projectId = suggestion.projectId ?? actionItem.project_id;
  const accountId = suggestion.accountId ?? actionItem.account_id;
  if (!projectId || !accountId) {
    throw new Error(
      'Link this email to a project before applying a retainer service',
    );
  }

  const { data: projectRow } = await db(input.admin)
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (!projectRow) {
    throw new Error('Project not found for this workspace');
  }

  let matchKind: RetainerMatchKind = suggestion.matchKind;
  let serviceId = input.serviceId ?? suggestion.serviceId;
  let creditCost = suggestion.creditCost;

  if (input.mode === 'skip') {
    matchKind = 'uncategorised';
    serviceId = null;
    creditCost = null;
  } else if (serviceId && serviceId !== suggestion.serviceId) {
    const { data: serviceRow } = await db(input.admin)
      .from('retainer_services')
      .select('*')
      .eq('id', serviceId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (!serviceRow) throw new Error('Service not found');
    const service = mapRetainerService(serviceRow as Record<string, unknown>);
    creditCost = service.creditCost;
    const { data: allow } = await db(input.admin)
      .from('project_retainer_services')
      .select('service_id')
      .eq('project_id', projectId)
      .eq('service_id', serviceId)
      .maybeSingle();
    matchKind = allow ? 'project_service' : 'workspace_service';
  }

  const addToProject =
    Boolean(input.addServiceToProject) ||
    (input.mode !== 'skip' &&
      matchKind === 'workspace_service' &&
      Boolean(serviceId));

  if (addToProject && serviceId) {
    await db(input.admin)
      .from('project_retainer_services')
      .upsert({ project_id: projectId, service_id: serviceId });
    matchKind = 'project_service';
  }

  if (matchKind === 'propose_new' && input.mode !== 'skip') {
    throw new Error(
      'Add the proposed service to the catalogue before applying',
    );
  }

  const { data: serviceRow } =
    serviceId && input.mode !== 'skip'
      ? await db(input.admin)
          .from('retainer_services')
          .select('*')
          .eq('id', serviceId)
          .maybeSingle()
      : { data: null };

  const service = serviceRow
    ? mapRetainerService(serviceRow as Record<string, unknown>)
    : null;

  const shouldBurn =
    input.mode !== 'skip' &&
    Boolean(service) &&
    (matchKind === 'project_service' || addToProject) &&
    (creditCost ?? 0) >= 1;

  const assigneeUserId =
    service?.defaultAssigneeId ??
    actionItem.suggested_assignee_id ??
    actionItem.user_id ??
    input.actorUserId;

  const status = service?.defaultStatus ?? 'todo';
  const durationMinutes =
    service?.defaultDurationMinutes ?? actionItem.suggested_duration_minutes;
  const nowIso = new Date().toISOString();

  const taskId = await insertEmailTask(input.admin, {
    userId: actionItem.user_id,
    title: actionItem.title,
    detail: actionItem.detail,
    sourceExcerpt: actionItem.source_excerpt,
    dueDate: actionItem.suggested_due_date,
    durationMinutes,
    projectId,
    clientId: actionItem.client_id ?? suggestion.clientId,
    accountId,
    status,
    assigneeUserId,
    retainerServiceId: null,
    creditsBurned: null,
    creditsBurnedAt: null,
    emailThreadId: actionItem.thread_id,
  });

  let burned = 0;
  if (shouldBurn && creditCost) {
    const consume = await consumeProjectRetainerCredits({
      projectId,
      accountId,
      amount: creditCost,
      serviceId: service!.id,
      taskId,
      suggestionId: suggestion.id,
      actorId: input.actorUserId,
      reason: input.mode === 'auto' ? 'auto_match' : 'apply_match',
    });

    if (!consume.ok) {
      throw new Error(
        consume.error === 'insufficient_balance'
          ? `Not enough project credits (need ${consume.requested}, have ${consume.available})`
          : (consume.error ?? 'Could not burn credits'),
      );
    }

    burned = consume.consumed ?? creditCost;
    const { error: stampError } = await db(input.admin)
      .from('tasks')
      .update({
        retainer_service_id: service!.id,
        credits_burned: burned,
        credits_burned_at: nowIso,
      })
      .eq('id', taskId);

    if (stampError) {
      await restoreProjectRetainerCredits({
        taskId,
        actorId: input.actorUserId,
        reason: 'stamp_failed',
      });
      throw new Error(stampError.message);
    }
  }

  await db(input.admin)
    .from('email_action_items')
    .update({
      task_id: taskId,
      status: 'accepted',
    })
    .eq('id', actionItem.id);

  await db(input.admin)
    .from('retainer_match_suggestions')
    .update({
      status:
        input.mode === 'auto'
          ? 'auto_applied'
          : input.mode === 'skip'
            ? 'skipped'
            : 'applied',
      task_id: taskId,
      applied_at: nowIso,
      service_id: shouldBurn ? (service?.id ?? null) : null,
      match_kind: matchKind,
      credit_cost: shouldBurn ? creditCost : null,
    })
    .eq('id', suggestion.id);

  if (assigneeUserId && assigneeUserId !== input.actorUserId) {
    const [{ data: account }, { data: project }] = await Promise.all([
      db(input.admin)
        .from('accounts')
        .select('slug')
        .eq('id', accountId)
        .maybeSingle(),
      db(input.admin)
        .from('projects')
        .select('name, title')
        .eq('id', projectId)
        .maybeSingle(),
    ]);

    if (account?.slug) {
      await notifyJobTaskAssigned({
        accountId,
        accountSlug: String(account.slug),
        jobId: projectId,
        jobTitle:
          String(project?.title ?? project?.name ?? 'Project').trim() ||
          'Project',
        taskTitle: String(actionItem.title ?? 'Task'),
        assigneeUserId,
        actorUserId: input.actorUserId,
      });
    }
  }

  return { taskId, burned };
}

export async function undoRetainerBurn(input: {
  admin: SupabaseClient;
  taskId: string;
  actorUserId: string;
}): Promise<{ refunded: number }> {
  const { data: task, error } = await db(input.admin)
    .from('tasks')
    .select(
      'id, account_id, credits_burned, credits_burned_at, retainer_service_id',
    )
    .eq('id', input.taskId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!task) throw new Error('Task not found');
  if (!task.credits_burned || !task.credits_burned_at) {
    throw new Error('This task has no retainer credits to undo');
  }
  if (!isUndoWindowOpen(task.credits_burned_at as string)) {
    throw new Error('The 24-hour undo window has closed');
  }

  const restored = await restoreProjectRetainerCredits({
    taskId: input.taskId,
    actorId: input.actorUserId,
    reason: 'undo_window',
  });

  if (!restored.ok) {
    throw new Error(
      restored.error === 'undo_window_expired'
        ? 'The 24-hour undo window has closed'
        : (restored.error ?? 'Could not restore credits'),
    );
  }

  const { error: updateError } = await db(input.admin)
    .from('tasks')
    .update({
      retainer_service_id: null,
      credits_burned: null,
      credits_burned_at: null,
    })
    .eq('id', input.taskId);

  if (updateError) throw new Error(updateError.message);

  return { refunded: restored.refunded ?? Number(task.credits_burned) };
}

export async function createProposedRetainerService(input: {
  admin: SupabaseClient;
  accountId: string;
  name: string;
  description?: string | null;
  creditCost: number;
  addToProjectId?: string | null;
}): Promise<{ serviceId: string }> {
  const { data, error } = await db(input.admin)
    .from('retainer_services')
    .insert({
      account_id: input.accountId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      credit_cost: input.creditCost,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not create service');
  }

  if (input.addToProjectId) {
    await db(input.admin).from('project_retainer_services').upsert({
      project_id: input.addToProjectId,
      service_id: data.id,
    });
  }

  return { serviceId: String(data.id) };
}
