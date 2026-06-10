import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type AccountBranch = {
  id: string;
  accountId: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isDefault: boolean;
  sortOrder: number;
};

type AccountBranchRow = {
  id: string;
  account_id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  is_default?: boolean | null;
  sort_order?: number | null;
};

function mapBranch(row: AccountBranchRow): AccountBranch {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name.trim(),
    address: row.address?.trim() || null,
    phone: row.phone?.trim() || null,
    email: row.email?.trim() || null,
    isDefault: Boolean(row.is_default),
    sortOrder: row.sort_order ?? 0,
  };
}

export async function loadAccountBranches(
  accountId: string,
): Promise<AccountBranch[]> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('account_branches')
    .select('*')
    .eq('account_id', accountId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AccountBranchRow[]).map(mapBranch);
}

export async function loadAccountBranchById(
  accountId: string,
  branchId: string,
): Promise<AccountBranch | null> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('account_branches')
    .select('*')
    .eq('account_id', accountId)
    .eq('id', branchId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapBranch(data as AccountBranchRow) : null;
}

export async function loadDefaultAccountBranch(
  accountId: string,
): Promise<AccountBranch | null> {
  const branches = await loadAccountBranches(accountId);
  return branches.find((b) => b.isDefault) ?? branches[0] ?? null;
}

export async function resolveBranchForStaff(input: {
  accountId: string;
  branchId?: string | null;
}): Promise<AccountBranch | null> {
  if (input.branchId) {
    const branch = await loadAccountBranchById(input.accountId, input.branchId);
    if (branch) return branch;
  }
  return loadDefaultAccountBranch(input.accountId);
}
