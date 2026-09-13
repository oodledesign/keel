import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type LooseFamilyQuery = {
  select: (columns?: string) => LooseFamilyQuery;
  insert: (values: unknown) => LooseFamilyQuery;
  update: (values: unknown) => LooseFamilyQuery;
  delete: () => LooseFamilyQuery;
  eq: (column: string, value: string) => LooseFamilyQuery;
  is: (column: string, value: null) => LooseFamilyQuery;
  in: (column: string, values: string[]) => LooseFamilyQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => LooseFamilyQuery;
  maybeSingle: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
  single: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

export function fromUntypedTable(table: string): LooseFamilyQuery {
  const client = getSupabaseServerClient();
  return (
    client as unknown as { from: (name: string) => LooseFamilyQuery }
  ).from(table);
}

export function applyMealPlanScope(
  query: LooseFamilyQuery,
  scope: { kind: 'personal' | 'workspace'; userId: string; accountId?: string },
) {
  if (scope.kind === 'workspace' && scope.accountId) {
    return query.eq('account_id', scope.accountId);
  }

  return query.eq('user_id', scope.userId).is('account_id', null);
}
