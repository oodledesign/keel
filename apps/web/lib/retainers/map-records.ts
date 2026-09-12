import { TASK_STATUS_VALUES, type TaskStatusValue } from './constants';
import type { RetainerMatchKind, RetainerSuggestionStatus } from './constants';
import type {
  ProjectRetainerBurn,
  ProjectRetainerRecord,
  RetainerMatchSuggestion,
  RetainerServiceRecord,
} from './types';

function asTaskStatus(value: unknown): TaskStatusValue | null {
  if (typeof value !== 'string') return null;
  return (TASK_STATUS_VALUES as readonly string[]).includes(value)
    ? (value as TaskStatusValue)
    : null;
}

export function mapRetainerService(
  row: Record<string, unknown>,
): RetainerServiceRecord {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    name: String(row.name ?? ''),
    description: row.description ? String(row.description) : null,
    creditCost: Number(row.credit_cost ?? 1),
    defaultStatus: asTaskStatus(row.default_status),
    defaultAssigneeId: row.default_assignee_id
      ? String(row.default_assignee_id)
      : null,
    defaultDurationMinutes:
      typeof row.default_duration_minutes === 'number' &&
      row.default_duration_minutes > 0
        ? Math.round(row.default_duration_minutes)
        : null,
    isActive: Boolean(row.is_active ?? true),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapProjectRetainer(
  row: Record<string, unknown>,
  allowedServiceIds: string[] = [],
): ProjectRetainerRecord {
  return {
    projectId: String(row.project_id),
    accountId: String(row.account_id),
    creditBalance: Number(row.credit_balance ?? 0),
    autoMatchEnabled: Boolean(row.auto_match_enabled),
    weeklyDigestEnabled: Boolean(row.weekly_digest_enabled),
    allowedServiceIds,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapMatchSuggestion(
  row: Record<string, unknown>,
  serviceName?: string | null,
): RetainerMatchSuggestion {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    projectId: row.project_id ? String(row.project_id) : null,
    clientId: row.client_id ? String(row.client_id) : null,
    emailThreadId: row.email_thread_id ? String(row.email_thread_id) : null,
    emailActionItemId: row.email_action_item_id
      ? String(row.email_action_item_id)
      : null,
    matchKind: String(row.match_kind) as RetainerMatchKind,
    serviceId: row.service_id ? String(row.service_id) : null,
    serviceName: serviceName ?? null,
    proposedName: row.proposed_name ? String(row.proposed_name) : null,
    proposedDescription: row.proposed_description
      ? String(row.proposed_description)
      : null,
    proposedCreditCost:
      typeof row.proposed_credit_cost === 'number'
        ? row.proposed_credit_cost
        : row.proposed_credit_cost
          ? Number(row.proposed_credit_cost)
          : null,
    confidence: row.confidence == null ? null : Number(row.confidence),
    rationale: row.rationale ? String(row.rationale) : null,
    creditCost: row.credit_cost == null ? null : Number(row.credit_cost),
    status: String(row.status ?? 'pending') as RetainerSuggestionStatus,
    taskId: row.task_id ? String(row.task_id) : null,
    appliedAt: row.applied_at ? String(row.applied_at) : null,
    createdAt: String(row.created_at ?? ''),
  };
}

export function mapRetainerBurn(
  row: Record<string, unknown>,
): ProjectRetainerBurn {
  return {
    id: String(row.id),
    amount: Number(row.amount ?? 0),
    serviceId: row.service_id ? String(row.service_id) : null,
    serviceName: row.service_name ? String(row.service_name) : null,
    taskId: row.task_id ? String(row.task_id) : null,
    taskTitle: row.task_title ? String(row.task_title) : null,
    createdAt: String(row.created_at ?? ''),
    type: String(row.type ?? 'burn') as ProjectRetainerBurn['type'],
  };
}
