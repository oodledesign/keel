/**
 * Narrow escape hatch for retainer tables until `pnpm supabase:web:typegen`
 * is run against a migrated local database.
 */
export type LooseQueryError = {
  message: string;
  code?: string;
} | null;

export type LooseQueryResult<T = unknown> = {
  data: T;
  error: LooseQueryError;
};

export type LooseQuery = {
  select: (columns?: string) => LooseQuery;
  insert: (values: unknown) => LooseQuery;
  update: (values: Record<string, unknown>) => LooseQuery;
  upsert: (values: unknown) => LooseQuery;
  delete: () => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  in: (column: string, values: readonly unknown[]) => LooseQuery;
  gte: (column: string, value: unknown) => LooseQuery;
  lt: (column: string, value: unknown) => LooseQuery;
  not: (column: string, operator: string, value: unknown) => LooseQuery;
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => LooseQuery;
  limit: (count: number) => LooseQuery;
  maybeSingle: () => Promise<LooseQueryResult<Record<string, unknown> | null>>;
  single: () => Promise<LooseQueryResult<Record<string, unknown> | null>>;
  then: Promise<LooseQueryResult<unknown[] | null>>['then'];
};

export type LooseClient = {
  from: (table: string) => LooseQuery;
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<LooseQueryResult<unknown>>;
};

export function looseClient(client: unknown): LooseClient {
  return client as LooseClient;
}
