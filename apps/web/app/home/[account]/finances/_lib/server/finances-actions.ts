'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { suggestTransactionCategories } from '~/lib/ai/finance-category-suggest';
import {
  type CsvColumnMapping,
  parseMoneyPence,
  parseUkDate,
  suggestCsvColumnMapping,
} from '~/lib/ai/finance-csv-map';
import { getWorkspaceCurrencyWithClient } from '~/lib/currency/get-workspace-currency';
import { normalizeWorkspaceCurrency } from '~/lib/currency/workspace-currency';
import { buildCsvTransactionExternalId } from '~/lib/finance/csv-transaction-id';
import { matchPropertyFromReference } from '~/lib/finance/match-property-from-reference';
import {
  PROPERTY_FINANCE_DEFAULT_CATEGORIES,
  suggestPropertyImportCategoryId,
} from '~/lib/finance/property-finance-categories';
import {
  projectDisplayName,
  resolveFinanceTransactionLinks,
} from '~/lib/finance/transaction-links';
import { accumulateFinanceTotals } from '~/lib/finance/transaction-totals';
import { isFreeAgentConfigured } from '~/lib/integrations/freeagent/env';
import {
  hasFreeAgentFinanceConnection,
  loadFinanceCategoriesForAccount,
} from '~/lib/integrations/freeagent/finance-categories';
import {
  pushCategoryToFreeAgent,
  syncFreeAgentHistoryChunk,
  syncFreeAgentToOzer,
} from '~/lib/integrations/freeagent/sync';
import { isStarlingConfigured } from '~/lib/integrations/starling/env';
import { syncStarlingToOzer } from '~/lib/integrations/starling/sync';

import { DEFAULT_FINANCE_PAGE_SIZE } from '../finance-transaction-pagination';

function applyFinanceDateFilters<
  T extends {
    gte: (col: string, val: string) => T;
    lte: (col: string, val: string) => T;
  },
>(query: T, dateFrom?: string, dateTo?: string) {
  let next = query;
  if (dateFrom) next = next.gte('transaction_date', dateFrom);
  if (dateTo) next = next.lte('transaction_date', dateTo);
  return next;
}

function applyFinanceSearchFilter<
  T extends {
    ilike: (col: string, pattern: string) => T;
    or?: (filters: string) => T;
  },
>(query: T, search?: string) {
  const term = search?.trim();
  if (!term) return query;
  const escaped = term.replace(/[%_\\]/g, '\\$&');
  if (typeof query.or === 'function') {
    return query.or(`description.ilike.%${escaped}%,notes.ilike.%${escaped}%`);
  }
  return query.ilike('description', `%${escaped}%`);
}

/** Load every matching summary row (paginated past PostgREST max_rows). */
async function loadFinanceSummaryRows(
  client: ReturnType<typeof getSupabaseServerClient>,
  accountId: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const pageSize = 1000;
  const hardCap = 20000;
  const rows: Array<{
    transaction_date: string;
    amount_pence: number;
    is_transfer: boolean | null;
    currency: string | null;
  }> = [];

  for (let offset = 0; offset < hardCap; offset += pageSize) {
    let query = client
      .from('finance_transactions')
      .select('transaction_date, amount_pence, is_transfer, currency')
      .eq('account_id', accountId)
      .order('transaction_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    query = applyFinanceDateFilters(query, dateFrom, dateTo);

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data ?? []) as Array<{
      transaction_date: string;
      amount_pence: number;
      is_transfer: boolean | null;
      currency: string | null;
    }>;
    rows.push(...batch);

    if (batch.length < pageSize) break;
  }

  return rows;
}

const DEFAULT_CATEGORIES = [
  { name: 'Sales', kind: 'income' as const },
  { name: 'Other income', kind: 'income' as const },
  { name: 'Software & subscriptions', kind: 'expense' as const },
  { name: 'Travel', kind: 'expense' as const },
  { name: 'Office & admin', kind: 'expense' as const },
  { name: 'Uncategorised', kind: 'expense' as const },
];

async function isPropertyFinanceAccount(
  client: ReturnType<typeof getSupabaseServerClient>,
  accountId: string,
) {
  const [{ data: account }, { data: business }] = await Promise.all([
    client
      .from('accounts')
      .select('space_type')
      .eq('id', accountId)
      .maybeSingle(),
    client
      .from('businesses')
      .select('type')
      .eq('account_id', accountId)
      .maybeSingle(),
  ]);

  const spaceType = String(
    (account as { space_type?: string | null } | null)?.space_type ?? 'work',
  ).toLowerCase();
  const businessType = String(
    (business as { type?: string | null } | null)?.type ?? '',
  ).toLowerCase();
  return spaceType === 'property' || businessType === 'property';
}

function revalidateFinances(accountSlug: string, projectId?: string | null) {
  revalidatePath(
    pathsConfig.app.accountFinances.replace('[account]', accountSlug),
  );
  revalidatePath(
    pathsConfig.app.accountFinancesSettings.replace('[account]', accountSlug),
  );
  revalidatePath(pathsConfig.app.accountHome.replace('[account]', accountSlug));
  if (projectId) {
    revalidatePath(
      `${pathsConfig.app.accountProjects.replace('[account]', accountSlug)}/${projectId}`,
    );
  }
}

export async function ensureDefaultFinanceCategories(accountId: string) {
  const client = getSupabaseServerClient();

  if (await hasFreeAgentFinanceConnection(client, accountId)) {
    return;
  }

  const { count: linkedCount } = await client
    .from('finance_categories')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .not('freeagent_category_url', 'is', null);

  if ((linkedCount ?? 0) > 0) {
    return;
  }

  const { count, error: countError } = await client
    .from('finance_categories')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId);

  if (countError) {
    throw new Error(countError.message || 'Could not load finance categories');
  }

  if ((count ?? 0) > 0) return;

  const propertyWorkspace = await isPropertyFinanceAccount(client, accountId);
  const seedCategories = propertyWorkspace
    ? PROPERTY_FINANCE_DEFAULT_CATEGORIES
    : DEFAULT_CATEGORIES;

  const { error: insertError } = await client.from('finance_categories').insert(
    seedCategories.map((c) => ({
      account_id: accountId,
      name: c.name,
      kind: c.kind,
      is_system: true,
    })),
  );

  if (insertError && !insertError.message.includes('duplicate')) {
    throw new Error(
      insertError.message || 'Could not create default categories',
    );
  }
}

async function ensurePropertyFinanceCategories(accountId: string) {
  const client = getSupabaseServerClient();

  if (!(await isPropertyFinanceAccount(client, accountId))) {
    return;
  }

  if (await hasFreeAgentFinanceConnection(client, accountId)) {
    return;
  }

  const { data: existing, error } = await client
    .from('finance_categories')
    .select('name, kind')
    .eq('account_id', accountId);

  if (error) {
    throw new Error(error.message || 'Could not load finance categories');
  }

  const existingKeys = new Set(
    (existing ?? []).map(
      (row) => `${String(row.kind)}:${String(row.name).toLowerCase()}`,
    ),
  );

  const missing = PROPERTY_FINANCE_DEFAULT_CATEGORIES.filter(
    (category) =>
      !existingKeys.has(`${category.kind}:${category.name.toLowerCase()}`),
  );

  if (missing.length === 0) return;

  const { error: insertError } = await client.from('finance_categories').insert(
    missing.map((category) => ({
      account_id: accountId,
      name: category.name,
      kind: category.kind,
      is_system: true,
    })),
  );

  if (insertError && !insertError.message.includes('duplicate')) {
    throw new Error(
      insertError.message || 'Could not create property finance categories',
    );
  }
}

export const loadFinancesDashboardAction = enhanceAction(
  async (input) => {
    await ensureDefaultFinanceCategories(input.accountId);
    await ensurePropertyFinanceCategories(input.accountId);
    const client = getSupabaseServerClient();
    const propertyWorkspace = await isPropertyFinanceAccount(
      client,
      input.accountId,
    );

    const from = input.dateFrom;
    const to = input.dateTo;
    const search = input.search?.trim() ?? '';
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? DEFAULT_FINANCE_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    let txQuery = client
      .from('finance_transactions')
      .select(
        `id, transaction_date, description, notes, amount_pence, category_id, is_transfer, source, sync_status, bank_account_id,
        client_id, project_id, property_id,
        clients:client_id ( id, display_name ),
        projects:project_id ( id, title, name ),
        properties:property_id ( id, name )`,
      )
      .eq('account_id', input.accountId)
      .order('transaction_date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);

    txQuery = applyFinanceDateFilters(txQuery, from, to);
    txQuery = applyFinanceSearchFilter(txQuery, search);

    let countQuery = client
      .from('finance_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', input.accountId);
    countQuery = applyFinanceDateFilters(countQuery, from, to);
    countQuery = applyFinanceSearchFilter(countQuery, search);

    let uncategorizedQuery = client
      .from('finance_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', input.accountId)
      .is('category_id', null)
      .eq('is_transfer', false);
    uncategorizedQuery = applyFinanceDateFilters(uncategorizedQuery, from, to);

    const [
      { data: transactions, error: txError },
      { count: transactionTotalCount, error: countError },
      summaryRows,
      { count: uncategorizedCount, error: uncategorizedError },
      categories,
      { data: bankAccounts },
      { data: connections },
      { data: clients },
      { data: projects },
      { data: properties },
    ] = await Promise.all([
      txQuery,
      countQuery,
      loadFinanceSummaryRows(client, input.accountId, from, to),
      uncategorizedQuery,
      loadFinanceCategoriesForAccount(client, input.accountId),
      client
        .from('finance_bank_accounts')
        .select('id, name, currency, source, last_synced_at')
        .eq('account_id', input.accountId)
        .eq('is_active', true)
        .order('name'),
      client
        .from('finance_connections')
        .select(
          'id, provider, freeagent_company_name, last_sync_at, token_expires_at, sync_state',
        )
        .eq('account_id', input.accountId)
        .in('provider', ['freeagent', 'starling']),
      client
        .from('clients')
        .select('id, display_name')
        .eq('account_id', input.accountId)
        .order('display_name')
        .limit(200),
      client
        .from('projects')
        .select('id, title, name, client_id')
        .eq('account_id', input.accountId)
        .order('updated_at', { ascending: false })
        .limit(300),
      client
        .from('properties')
        .select('id, name, address')
        .eq('account_id', input.accountId)
        .order('name')
        .limit(500),
    ]);

    if (txError) throw txError;
    if (countError) throw countError;
    if (uncategorizedError) throw uncategorizedError;

    const displayCurrency = await getWorkspaceCurrencyWithClient(
      client,
      input.accountId,
    );

    const currenciesInRange = new Set(
      summaryRows.map((row) =>
        normalizeWorkspaceCurrency(
          row.currency?.trim() ? row.currency.toLowerCase() : null,
          displayCurrency,
        ),
      ),
    );
    const mixedCurrencies = currenciesInRange.size > 1;

    const summaryRowsForTotals = summaryRows.filter(
      (row) =>
        normalizeWorkspaceCurrency(
          row.currency?.trim() ? row.currency.toLowerCase() : null,
          displayCurrency,
        ) === displayCurrency,
    );

    const totals = accumulateFinanceTotals(
      summaryRowsForTotals.map((tx) => ({
        amount_pence: tx.amount_pence,
        is_transfer: tx.is_transfer,
      })),
    );

    const connectionList = connections ?? [];
    const freeagentConnection =
      connectionList.find((row) => row.provider === 'freeagent') ?? null;
    const starlingConnection =
      connectionList.find((row) => row.provider === 'starling') ?? null;

    return {
      transactions: transactions ?? [],
      summaryRows,
      transactionTotalCount: transactionTotalCount ?? 0,
      uncategorizedCount: uncategorizedCount ?? 0,
      page,
      pageSize,
      search,
      categories: categories ?? [],
      bankAccounts: bankAccounts ?? [],
      connection: freeagentConnection,
      starlingConnection,
      clients: clients ?? [],
      projects: (projects ?? []).map((project) => ({
        id: project.id as string,
        label: projectDisplayName(
          project as { title?: string | null; name?: string | null },
        ),
        client_id: (project.client_id as string | null) ?? null,
      })),
      properties: (properties ?? []).map((property) => ({
        id: property.id as string,
        label: String(property.name ?? property.id),
        address: (property.address as string | null) ?? null,
      })),
      isPropertyWorkspace: propertyWorkspace,
      displayCurrency,
      mixedCurrencies,
      summary: {
        incomePence: totals.incomePence,
        expensePence: totals.expensePence,
        netPence: totals.netPence,
        transferPence: totals.transferPence,
      },
      freeAgentConfigured: isFreeAgentConfigured(),
      starlingConfigured: isStarlingConfigured(),
    };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      page: z.number().int().min(1).optional(),
      pageSize: z
        .union([z.literal(50), z.literal(100), z.literal(200)])
        .optional(),
      search: z.string().max(200).optional(),
    }),
  },
);

export const setFinanceTransactionLinksAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();

    const links = await resolveFinanceTransactionLinks(
      client,
      input.accountId,
      {
        clientId: input.clientId,
        projectId: input.projectId,
      },
    );

    const { error } = await client
      .from('finance_transactions')
      .update({
        client_id: links.client_id,
        project_id: links.project_id,
      })
      .eq('id', input.transactionId)
      .eq('account_id', input.accountId);

    if (error) throw error;

    revalidateFinances(input.accountSlug, links.project_id);
    return { ok: true, ...links };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      transactionId: z.string().uuid(),
      clientId: z.string().uuid().nullable(),
      projectId: z.string().uuid().nullable(),
    }),
  },
);

export const setFinanceTransactionPropertyAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();

    if (input.propertyId) {
      const { data: property, error: propertyError } = await client
        .from('properties')
        .select('id')
        .eq('id', input.propertyId)
        .eq('account_id', input.accountId)
        .maybeSingle();

      if (propertyError) {
        throw new Error(propertyError.message || 'Could not load property');
      }
      if (!property) {
        throw new Error('Property not found');
      }
    }

    const { error } = await client
      .from('finance_transactions')
      .update({ property_id: input.propertyId })
      .eq('id', input.transactionId)
      .eq('account_id', input.accountId);

    if (error) throw error;

    revalidateFinances(input.accountSlug);
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      transactionId: z.string().uuid(),
      propertyId: z.string().uuid().nullable(),
    }),
  },
);

export const setFinanceTransactionNotesAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('finance_transactions')
      .update({ notes: input.notes?.trim() || null })
      .eq('id', input.transactionId)
      .eq('account_id', input.accountId);

    if (error) throw error;

    revalidateFinances(input.accountSlug);
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      transactionId: z.string().uuid(),
      notes: z.string().max(2000).nullable(),
    }),
  },
);

export const setFinanceTransferAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('finance_transactions')
      .update({
        is_transfer: input.isTransfer,
        ...(input.isTransfer
          ? {
              category_id: null,
              sync_status: 'local',
            }
          : {}),
      })
      .eq('id', input.transactionId)
      .eq('account_id', input.accountId);

    if (error) throw error;

    revalidateFinances(input.accountSlug);
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      transactionId: z.string().uuid(),
      isTransfer: z.boolean(),
    }),
  },
);

export const categorizeFinanceTransactionAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('finance_transactions')
      .update({
        category_id: input.categoryId,
        sync_status: input.pushToFreeAgent ? 'pending_push' : 'local',
      })
      .eq('id', input.transactionId)
      .eq('account_id', input.accountId);

    if (error) throw error;

    if (input.pushToFreeAgent) {
      await pushCategoryToFreeAgent(
        client,
        input.accountId,
        input.transactionId,
      );
    }

    revalidateFinances(input.accountSlug);
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      transactionId: z.string().uuid(),
      categoryId: z.string().uuid().nullable(),
      pushToFreeAgent: z.boolean().optional().default(true),
    }),
  },
);

export const syncFreeAgentAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const result = await syncFreeAgentToOzer(client, input.accountId, {
      mode: 'full',
    });
    revalidateFinances(input.accountSlug);
    return result;
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
    }),
  },
);

export const syncFreeAgentHistoryChunkAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const result = await syncFreeAgentHistoryChunk(client, input.accountId, {
      reset: input.reset,
    });
    revalidateFinances(input.accountSlug);
    return result;
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      reset: z.boolean().optional(),
    }),
  },
);

export const loadFinancesSettingsAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();

    const { data: connection, error } = await client
      .from('finance_connections')
      .select(
        'id, provider, freeagent_company_name, last_sync_at, token_expires_at, sync_state',
      )
      .eq('account_id', input.accountId)
      .eq('provider', 'freeagent')
      .maybeSingle();

    if (error) throw error;

    return {
      connection: connection ?? null,
      freeAgentConfigured: isFreeAgentConfigured(),
    };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
    }),
  },
);

export const disconnectFreeAgentAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('finance_connections')
      .delete()
      .eq('account_id', input.accountId)
      .eq('provider', 'freeagent');
    if (error) throw error;
    revalidateFinances(input.accountSlug);
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
    }),
  },
);

export const syncStarlingAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const result = await syncStarlingToOzer(client, input.accountId, {
      mode: 'full',
    });
    revalidateFinances(input.accountSlug);
    return result;
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
    }),
  },
);

export const disconnectStarlingAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('finance_connections')
      .delete()
      .eq('account_id', input.accountId)
      .eq('provider', 'starling');
    if (error) throw error;
    revalidateFinances(input.accountSlug);
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
    }),
  },
);

export const suggestCsvMappingAction = enhanceAction(
  async (input) =>
    suggestCsvColumnMapping({
      headers: input.headers,
      sampleRows: input.sampleRows,
    }),
  {
    schema: z.object({
      headers: z.array(z.string()).min(1).max(100),
      sampleRows: z.preprocess(
        (value) => (Array.isArray(value) ? value.slice(0, 5) : value),
        z.array(z.array(z.string())).max(20),
      ),
    }),
  },
);

export const importCsvTransactionsAction = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();
    const propertyWorkspace = await isPropertyFinanceAccount(
      client,
      input.accountId,
    );

    let bankAccountId = input.bankAccountId ?? null;
    if (!bankAccountId) {
      const { data: ba } = await client
        .from('finance_bank_accounts')
        .insert({
          account_id: input.accountId,
          name: input.bankAccountName || 'Imported account',
          source: 'csv',
        })
        .select('id')
        .single();
      bankAccountId = ba?.id ?? null;
    }

    const { data: batch, error: batchError } = await client
      .from('finance_import_batches')
      .insert({
        account_id: input.accountId,
        bank_account_id: bankAccountId,
        filename: input.filename,
        column_mapping: input.mapping,
        status: 'imported',
        row_count: input.rows.length,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (batchError) throw batchError;

    const mapping = input.mapping as CsvColumnMapping;

    const [{ data: properties }, categories] = await Promise.all([
      propertyWorkspace
        ? client
            .from('properties')
            .select('id, name, address')
            .eq('account_id', input.accountId)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              name: string;
              address: string | null;
            }>,
          }),
      loadFinanceCategoriesForAccount(client, input.accountId),
    ]);

    const parsedRows: Array<{
      transactionDate: string;
      description: string;
      reference: string;
      notes: string | null;
      amountPence: number;
      spendingCategory: string;
      externalId: string;
      propertyId: string | null;
      categoryId: string | null;
    }> = [];

    for (const row of input.rows) {
      const get = (col?: string) =>
        col ? String(row[input.headers.indexOf(col)] ?? '').trim() : '';

      const dateStr = parseUkDate(get(mapping.date), input.dateFormat);
      if (!dateStr) continue;

      let amountPence: number | null = null;
      if (mapping.amount) {
        amountPence = parseMoneyPence(get(mapping.amount));
      } else {
        const debit = parseMoneyPence(get(mapping.debit));
        const credit = parseMoneyPence(get(mapping.credit));
        if (credit != null && credit !== 0) amountPence = credit;
        else if (debit != null && debit !== 0) amountPence = -Math.abs(debit);
      }
      if (amountPence == null || amountPence === 0) continue;

      const description = get(mapping.description) || 'Imported transaction';
      const reference = get(mapping.reference);
      const csvNotes = get(mapping.notes);
      const spendingCategory = get(mapping.spendingCategory);
      const noteParts = [reference, csvNotes].filter(Boolean);
      const notes = noteParts.length > 0 ? noteParts.join(' · ') : null;

      const externalId = buildCsvTransactionExternalId({
        accountId: input.accountId,
        bankAccountId,
        transactionDate: dateStr,
        amountPence,
        counterparty: description,
        reference,
      });

      const propertyId =
        propertyWorkspace && reference
          ? matchPropertyFromReference(reference, properties ?? [])
          : null;

      const categoryId = propertyWorkspace
        ? suggestPropertyImportCategoryId(categories, {
            amountPence,
            spendingCategory,
            counterparty: description,
          })
        : null;

      parsedRows.push({
        transactionDate: dateStr,
        description,
        reference,
        notes,
        amountPence,
        spendingCategory,
        externalId,
        propertyId,
        categoryId,
      });
    }

    const externalIds = parsedRows.map((row) => row.externalId);
    const existingIds = new Set<string>();

    for (let offset = 0; offset < externalIds.length; offset += 500) {
      const chunk = externalIds.slice(offset, offset + 500);
      if (chunk.length === 0) continue;

      const { data: existingRows, error: existingError } = await client
        .from('finance_transactions')
        .select('external_id')
        .eq('account_id', input.accountId)
        .in('external_id', chunk);

      if (existingError) throw existingError;
      for (const row of existingRows ?? []) {
        if (row.external_id) existingIds.add(row.external_id);
      }
    }

    const batchId = batch?.id;
    if (!batchId) {
      throw new Error('Import batch was not created');
    }

    const workspaceCurrency = await getWorkspaceCurrencyWithClient(
      client,
      input.accountId,
    );
    const currencyCode = workspaceCurrency.toUpperCase();

    const inserts = parsedRows
      .filter((row) => !existingIds.has(row.externalId))
      .map((row) => ({
        account_id: input.accountId,
        bank_account_id: bankAccountId,
        transaction_date: row.transactionDate,
        description: row.description,
        notes: row.notes,
        amount_pence: row.amountPence,
        currency: currencyCode,
        property_id: row.propertyId,
        category_id: row.categoryId,
        source: 'csv' as const,
        external_id: row.externalId,
        import_batch_id: batchId,
        sync_status: 'local' as const,
        created_by: user.id,
      }));

    const skipped = parsedRows.length - inserts.length;
    let imported = 0;

    for (let offset = 0; offset < inserts.length; offset += 500) {
      const chunk = inserts.slice(offset, offset + 500);
      const { error: insertError } = await client
        .from('finance_transactions')
        .insert(chunk);
      if (insertError) throw insertError;
      imported += chunk.length;
    }

    await client
      .from('finance_import_batches')
      .update({ imported_count: imported, status: 'imported' })
      .eq('id', batchId);

    revalidateFinances(input.accountSlug);
    return { imported, skipped, batchId };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      filename: z.string().min(1).max(500),
      headers: z.array(z.string()).min(1),
      rows: z.array(z.array(z.string())).max(5000),
      mapping: z.object({
        date: z.string(),
        description: z.string(),
        amount: z.string().optional(),
        debit: z.string().optional(),
        credit: z.string().optional(),
        reference: z.string().optional(),
        notes: z.string().optional(),
        spendingCategory: z.string().optional(),
      }),
      dateFormat: z.string().optional(),
      bankAccountId: z.string().uuid().nullable().optional(),
      bankAccountName: z.string().optional(),
    }),
  },
);

export const createManualTransactionAction = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();
    const links = await resolveFinanceTransactionLinks(
      client,
      input.accountId,
      {
        clientId: input.clientId,
        projectId: input.projectId,
      },
    );

    const workspaceCurrency = await getWorkspaceCurrencyWithClient(
      client,
      input.accountId,
    );

    const { error } = await client.from('finance_transactions').insert({
      account_id: input.accountId,
      bank_account_id: input.bankAccountId,
      category_id: input.categoryId,
      client_id: links.client_id,
      project_id: links.project_id,
      transaction_date: input.transactionDate,
      description: input.description,
      amount_pence: input.amountPence,
      currency: workspaceCurrency.toUpperCase(),
      source: 'manual',
      sync_status: 'local',
      created_by: user.id,
    });
    if (error) throw error;
    revalidateFinances(input.accountSlug, links.project_id);
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      bankAccountId: z.string().uuid().nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      clientId: z.string().uuid().nullable().optional(),
      projectId: z.string().uuid().nullable().optional(),
      transactionDate: z.string(),
      description: z.string().max(500),
      amountPence: z.number().int(),
    }),
  },
);

export const suggestTransactionCategoriesAction = enhanceAction(
  async (input) => {
    try {
      await ensureDefaultFinanceCategories(input.accountId);
      const client = getSupabaseServerClient();

      let txQuery = client
        .from('finance_transactions')
        .select('id, description, amount_pence, category_id, is_transfer')
        .eq('account_id', input.accountId)
        .eq('is_transfer', false)
        .is('category_id', null)
        .order('transaction_date', { ascending: false })
        .limit(input.limit ?? 40);

      if (input.dateFrom?.trim()) {
        txQuery = txQuery.gte('transaction_date', input.dateFrom.trim());
      }
      if (input.dateTo?.trim()) {
        txQuery = txQuery.lte('transaction_date', input.dateTo.trim());
      }

      const [transactionsResult, categories] = await Promise.all([
        txQuery,
        loadFinanceCategoriesForAccount(client, input.accountId),
      ]);

      const { data: transactions, error: txError } = transactionsResult;

      if (txError) {
        throw new Error(txError.message || 'Could not load transactions');
      }
      if (!categories.length) {
        throw new Error(
          'No categories found. Run Sync now to import categories from FreeAgent.',
        );
      }
      if (!transactions?.length) {
        return { suggestions: [] as const };
      }

      const suggestions = await suggestTransactionCategories({
        categories: categories.map((c) => ({
          id: c.id as string,
          name: c.name as string,
          kind: c.kind as 'income' | 'expense',
        })),
        transactions: transactions.map((t) => ({
          id: t.id as string,
          description: String(t.description),
          amountPence: t.amount_pence as number,
        })),
      });

      return { suggestions };
    } catch (err) {
      console.error('[suggestTransactionCategoriesAction]', err);
      throw err instanceof Error
        ? err
        : new Error('Could not suggest categories');
    }
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
  },
);

export const applySuggestedCategoriesAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    let applied = 0;
    let pushed = 0;
    let pushFailed = 0;

    for (const item of input.suggestions) {
      if (!item.categoryId) continue;
      const { error } = await client
        .from('finance_transactions')
        .update({
          category_id: item.categoryId,
          sync_status: input.pushToFreeAgent ? 'pending_push' : 'local',
        })
        .eq('id', item.transactionId)
        .eq('account_id', input.accountId)
        .is('category_id', null);

      if (error) throw new Error(error.message || 'Could not update category');

      applied++;

      if (input.pushToFreeAgent) {
        const synced = await pushCategoryToFreeAgent(
          client,
          input.accountId,
          item.transactionId,
        );
        if (synced) pushed++;
        else pushFailed++;
      }
    }

    revalidateFinances(input.accountSlug);
    return { applied, pushed, pushFailed };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      pushToFreeAgent: z.boolean().optional().default(true),
      suggestions: z.array(
        z.object({
          transactionId: z.string().uuid(),
          categoryId: z.string().uuid().nullable(),
        }),
      ),
    }),
  },
);

export const createFinanceCategoryAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { error } = await client.from('finance_categories').insert({
      account_id: input.accountId,
      name: input.name.trim(),
      kind: input.kind,
      color: input.color ?? null,
    });
    if (error) throw error;
    revalidateFinances(input.accountSlug);
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      name: z.string().min(1).max(100),
      kind: z.enum(['income', 'expense']),
      color: z.string().nullable().optional(),
    }),
  },
);
