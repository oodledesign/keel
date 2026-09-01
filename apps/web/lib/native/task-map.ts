import { resolveClientListTitle } from '~/lib/clients/resolve-client-list-display';

import { NativeHttpError } from './http';
import { type NativeTaskStatus, mapNativeTaskStatus } from './task-status';
import { type NativeWorkspace, isUuid } from './workspace-shared';

export const OPEN_NATIVE_TASK_DB_STATUSES = [
  'todo',
  'in_progress',
  'client_review',
] as const;

export type NativeTask = {
  id: string;
  title: string;
  status: NativeTaskStatus;
  due: string | null;
  workspace: string;
  client_id: string | null;
  client_name: string | null;
};

export type NativeTaskRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  due_date?: string | null;
  account_id?: string | null;
  user_id?: string | null;
  assignee_contact_id?: string | null;
  client_id?: string | null;
};

export type NativeTaskClientRow = {
  id: string;
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  client_type?: string | null;
};

export function isPersonalNativeWorkspace(workspace: NativeWorkspace) {
  return workspace.isPersonal || workspace.profile === 'personal';
}

export function parseOptionalClientId(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  const trimmed = value.trim();
  if (!isUuid(trimmed)) {
    throw new NativeHttpError(400, 'client_id must be a uuid');
  }
  return trimmed;
}

/**
 * Phone list visibility.
 *
 * Team / business / family: every task on this account — including `user_id` null.
 * That matches the web workspace list (`loadTasksForTeamAccount`) and is why
 * studio today-tasks were missing when we required `user_id = signed-in user`.
 *
 * Personal: this account only, plus the signed-in user or an unowned row.
 * Other members’ personal-account tasks stay hidden.
 *
 * Portal rows (`assignee_contact_id`) stay off the phone list.
 */
export function canSeeNativeTask(
  row: NativeTaskRow,
  userId: string,
  workspace: NativeWorkspace,
) {
  if (row.account_id !== workspace.id) {
    return false;
  }

  if (row.assignee_contact_id) {
    return false;
  }

  if (isPersonalNativeWorkspace(workspace)) {
    return !row.user_id || row.user_id === userId;
  }

  return true;
}

export function isOpenNativeTaskStatus(status: string | null | undefined) {
  return mapNativeTaskStatus(status) !== 'completed';
}

export function nativeClientName(
  row: NativeTaskClientRow | null | undefined,
): string | null {
  if (!row) return null;
  const name = resolveClientListTitle(row).trim();
  return name || null;
}

export function toNativeTask(
  row: NativeTaskRow,
  workspace: NativeWorkspace,
  clientName?: string | null,
): NativeTask {
  return {
    id: row.id,
    title: row.title?.trim() || 'Untitled task',
    status: mapNativeTaskStatus(row.status),
    due: row.due_date?.trim() || null,
    workspace: workspace.slug,
    client_id: row.client_id?.trim() || null,
    client_name: clientName?.trim() || null,
  };
}
