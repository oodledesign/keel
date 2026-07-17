import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export const KEEL_DEFAULT_CATEGORY_NAMES = [
  'Sales',
  'Other income',
  'Software & subscriptions',
  'Travel',
  'Office & admin',
  'Uncategorised',
] as const;

export function freeAgentCategoryDisplayName(
  cat: Record<string, unknown>,
): string {
  return String(cat.description ?? cat.name ?? 'Category').trim();
}

export function categoryKindFromFreeAgent(
  cat: Record<string, unknown>,
): 'income' | 'expense' {
  if (cat._defaultKind === 'income') return 'income';
  if (cat._defaultKind === 'expense') return 'expense';

  if (cat.is_income === true || cat.income === true) return 'income';
  if (cat.is_expense === true || cat.expense === true) return 'expense';

  const group = String(
    cat.group ?? cat.category_group ?? cat.group_description ?? cat.type ?? '',
  ).toLowerCase();

  if (
    group.includes('income') ||
    group.includes('sales') ||
    group.includes('revenue')
  ) {
    return 'income';
  }

  return 'expense';
}

export async function hasFreeAgentFinanceConnection(
  db: SupabaseClient,
  accountId: string,
): Promise<boolean> {
  const { data } = await db
    .from('finance_connections')
    .select('id')
    .eq('account_id', accountId)
    .eq('provider', 'freeagent')
    .maybeSingle();

  return Boolean(data?.id);
}

export async function loadFinanceCategoriesForAccount(
  db: SupabaseClient,
  accountId: string,
) {
  const freeAgentConnected = await hasFreeAgentFinanceConnection(db, accountId);

  const baseQuery = () =>
    db
      .from('finance_categories')
      .select('id, name, kind, color, freeagent_category_url')
      .eq('account_id', accountId)
      .order('kind')
      .order('name');

  if (freeAgentConnected) {
    const { data, error } = await baseQuery().not(
      'freeagent_category_url',
      'is',
      null,
    );
    if (error) throw error;
    if ((data ?? []).length > 0) {
      return data ?? [];
    }

    // FreeAgent connected but categories not synced yet — show all until sync runs.
    const { data: fallback, error: fallbackError } = await baseQuery();
    if (fallbackError) throw fallbackError;
    return fallback ?? [];
  }

  const { data, error } = await baseQuery();
  if (error) throw error;
  return data ?? [];
}

/** Remove Ozer's generic seed categories once FreeAgent categories are linked. */
export async function removeOzerDefaultCategories(
  db: SupabaseClient,
  accountId: string,
) {
  await db
    .from('finance_categories')
    .delete()
    .eq('account_id', accountId)
    .eq('is_system', true)
    .is('freeagent_category_url', null);
}

export async function buildCategoryUrlToIdMap(
  db: SupabaseClient,
  accountId: string,
): Promise<Map<string, string>> {
  const { data, error } = await db
    .from('finance_categories')
    .select('id, freeagent_category_url')
    .eq('account_id', accountId)
    .not('freeagent_category_url', 'is', null);

  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const url = String(row.freeagent_category_url ?? '').trim();
    if (url) map.set(url, row.id as string);
  }
  return map;
}
