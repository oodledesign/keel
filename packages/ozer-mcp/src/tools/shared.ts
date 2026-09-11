import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

type SupabaseLikeError = {
  message?: string;
} | null;

export function throwSupabaseError(
  operation: string,
  error: PostgrestError | SupabaseLikeError,
): never {
  throw new Error(
    error?.message ? `${operation}: ${error.message}` : `${operation} failed`,
  );
}

export function assertSupabaseOk<T>(
  data: T,
  error: PostgrestError | SupabaseLikeError,
  operation: string,
): T {
  if (error) {
    throwSupabaseError(operation, error);
  }
  return data;
}

export type McpWorkspace = {
  id: string;
  name: string | null;
  slug: string | null;
  space_type: string | null;
  is_personal_account: boolean;
};

type MembershipWorkspaceEmbed = {
  account_id?: string | null;
  accounts?: McpWorkspaceRow | McpWorkspaceRow[] | null;
  account?: McpWorkspaceRow | McpWorkspaceRow[] | null;
};

type McpWorkspaceRow = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  space_type?: string | null;
  is_personal_account?: boolean | null;
};

function unwrapEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function mapWorkspaceRow(
  row: McpWorkspaceRow | null,
  fallbackId?: string | null,
): McpWorkspace | null {
  const id = row?.id ?? fallbackId ?? null;
  if (!id) {
    return null;
  }

  return {
    id,
    name: row?.name?.trim() || null,
    slug: row?.slug?.trim() || null,
    space_type: row?.space_type ?? null,
    is_personal_account: Boolean(row?.is_personal_account),
  };
}

export async function loadUserWorkspaces(
  supabase: SupabaseClient,
  userId: string,
): Promise<McpWorkspace[]> {
  const withEmbed = await supabase
    .from('accounts_memberships')
    .select(
      'account_id, account:accounts(id, name, slug, space_type, is_personal_account)',
    )
    .eq('user_id', userId);

  const memberships = withEmbed.error
    ? await supabase
        .from('accounts_memberships')
        .select('account_id')
        .eq('user_id', userId)
    : withEmbed;

  assertSupabaseOk(
    memberships.data,
    memberships.error,
    'load account memberships',
  );

  const workspaces = new Map<string, McpWorkspace>();

  for (const row of (memberships.data ?? []) as MembershipWorkspaceEmbed[]) {
    const embedded = unwrapEmbed(row.account) ?? unwrapEmbed(row.accounts);
    const workspace = mapWorkspaceRow(embedded, row.account_id);
    if (workspace) {
      workspaces.set(workspace.id, workspace);
    }
  }

  return [...workspaces.values()].sort((left, right) => {
    if (left.is_personal_account !== right.is_personal_account) {
      return left.is_personal_account ? 1 : -1;
    }

    return (left.name ?? left.slug ?? left.id).localeCompare(
      right.name ?? right.slug ?? right.id,
    );
  });
}

export async function loadUserAccountIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const workspaces = await loadUserWorkspaces(supabase, userId);
  return workspaces.map((workspace) => workspace.id);
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

const MISSING_COLUMN_RE =
  /column\s+(?:[\w.]+\.)?['"]?(\w+)['"]?|Could not find the ['"](\w+)['"] column/i;

export function isMissingColumnError(
  error: { message?: string } | null | undefined,
): boolean {
  return Boolean(
    error?.message &&
    /column .* does not exist|schema cache|Could not find the ['"]\w+['"] column/i.test(
      error.message,
    ),
  );
}

export function isMissingRelationError(
  error: { message?: string } | null | undefined,
): boolean {
  return Boolean(
    error?.message &&
    /could not find the table|relation .* does not exist|schema cache/i.test(
      error.message,
    ),
  );
}

export function missingColumnName(
  error: { message?: string } | null | undefined,
): string | null {
  if (!error?.message || !isMissingColumnError(error)) {
    return null;
  }

  const match = error.message.match(MISSING_COLUMN_RE);
  return match?.[1] ?? match?.[2] ?? null;
}

export async function writeWithOptionalColumns<T>(
  write: (
    row: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
  row: Record<string, unknown>,
  operation: string,
): Promise<T> {
  const current = { ...row };
  let result = await write(current);

  for (let attempt = 0; attempt < 6 && result.error; attempt += 1) {
    const column = missingColumnName(result.error);
    if (!column || !(column in current)) {
      break;
    }

    delete current[column];
    result = await write(current);
  }

  assertSupabaseOk(result.data, result.error, operation);
  if (result.data == null) {
    throw new Error(`${operation} failed`);
  }

  return result.data as T;
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
