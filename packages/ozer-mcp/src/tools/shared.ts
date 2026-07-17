import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

export function throwSupabaseError(
  operation: string,
  error: PostgrestError | null,
): never {
  throw new Error(
    error?.message ? `${operation}: ${error.message}` : `${operation} failed`,
  );
}

export function assertSupabaseOk<T>(
  data: T,
  error: PostgrestError | null,
  operation: string,
): T {
  if (error) {
    throwSupabaseError(operation, error);
  }
  return data;
}

export async function loadUserAccountIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('accounts_memberships')
    .select('account_id')
    .eq('user_id', userId);

  assertSupabaseOk(data, error, 'load account memberships');

  return [
    ...new Set(
      (data ?? [])
        .map((row) => (row as { account_id: string }).account_id)
        .filter(Boolean),
    ),
  ];
}

export async function assertAccountAccess(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<void> {
  const accountIds = await loadUserAccountIds(supabase, userId);
  if (!accountIds.includes(accountId)) {
    throw new Error('Access denied for this workspace');
  }
}

export async function assertClientOrgAccess(
  supabase: SupabaseClient,
  userId: string,
  clientOrgId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('client_members')
    .select('id')
    .eq('user_id', userId)
    .eq('client_org_id', clientOrgId)
    .maybeSingle();

  assertSupabaseOk(data, error, 'verify client org access');

  if (!data) {
    throw new Error('Client org not found or access denied');
  }
}

export function toolJson(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function pickDefined<T extends Record<string, unknown>>(
  input: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export function dealDisplayName(row: {
  name?: string | null;
  company_name?: string | null;
  contact_name?: string | null;
}): string {
  return (
    row.name?.trim() ||
    row.company_name?.trim() ||
    row.contact_name?.trim() ||
    'Untitled deal'
  );
}

export const OPEN_TASK_STATUSES = [
  'todo',
  'in_progress',
  'client_review',
] as const;
