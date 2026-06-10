'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  parseMoneyPence,
  parseUkDate,
  suggestCsvColumnMapping,
  type CsvColumnMapping,
} from '~/lib/ai/finance-csv-map';
import { suggestTransactionCategories } from '~/lib/ai/finance-category-suggest';
import {
  pushCategoryToFreeAgent,
  syncFreeAgentToKeel,
} from '~/lib/integrations/freeagent/sync';
import {
  hasFreeAgentFinanceConnection,
  loadFinanceCategoriesForAccount,
} from '~/lib/integrations/freeagent/finance-categories';
import { isFreeAgentConfigured } from '~/lib/integrations/freeagent/env';

const DEFAULT_CATEGORIES = [
  { name: 'Sales', kind: 'income' as const },
  { name: 'Other income', kind: 'income' as const },
  { name: 'Software & subscriptions', kind: 'expense' as const },
  { name: 'Travel', kind: 'expense' as const },
  { name: 'Office & admin', kind: 'expense' as const },
  { name: 'Uncategorised', kind: 'expense' as const },
];

function revalidateFinances(accountSlug: string) {
  revalidatePath(
    pathsConfig.app.accountFinances.replace('[account]', accountSlug),
  );
  revalidatePath(
    pathsConfig.app.accountHome.replace('[account]', accountSlug),
  );
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

  const { error: insertError } = await client.from('finance_categories').insert(
    DEFAULT_CATEGORIES.map((c) => ({
      account_id: accountId,
      name: c.name,
      kind: c.kind,
      is_system: true,
    })),
  );

  if (insertError && !insertError.message.includes('duplicate')) {
    throw new Error(insertError.message || 'Could not create default categories');
  }
}

export const loadFinancesDashboardAction = enhanceAction(
  async (input) => {
    await ensureDefaultFinanceCategories(input.accountId);
    const client = getSupabaseServerClient();

    const from = input.dateFrom;
    const to = input.dateTo;

    let txQuery = client
      .from('finance_transactions')
      .select(
        'id, transaction_date, description, amount_pence, category_id, source, sync_status, bank_account_id',
      )
      .eq('account_id', input.accountId)
      .order('transaction_date', { ascending: false })
      .limit(500);

    if (from) txQuery = txQuery.gte('transaction_date', from);
    if (to) txQuery = txQuery.lte('transaction_date', to);

    const [
      { data: transactions, error: txError },
      categories,
      { data: bankAccounts },
      { data: connection },
    ] = await Promise.all([
      txQuery,
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
          'id, freeagent_company_name, last_sync_at, token_expires_at',
        )
        .eq('account_id', input.accountId)
        .eq('provider', 'freeagent')
        .maybeSingle(),
    ]);

    if (txError) throw txError;

    let incomePence = 0;
    let expensePence = 0;
    for (const tx of transactions ?? []) {
      const pence = tx.amount_pence as number;
      if (pence >= 0) incomePence += pence;
      else expensePence += Math.abs(pence);
    }

    return {
      transactions: transactions ?? [],
      categories: categories ?? [],
      bankAccounts: bankAccounts ?? [],
      connection: connection ?? null,
      summary: {
        incomePence,
        expensePence,
        netPence: incomePence - expensePence,
      },
      freeAgentConfigured: isFreeAgentConfigured(),
    };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
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
    const result = await syncFreeAgentToKeel(client, input.accountId);
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

export const suggestCsvMappingAction = enhanceAction(
  async (input) => suggestCsvColumnMapping(input),
  {
    schema: z.object({
      headers: z.array(z.string()).min(1).max(100),
      sampleRows: z.array(z.array(z.string())).max(20),
    }),
  },
);

export const importCsvTransactionsAction = enhanceAction(
  async (input, user) => {
    const client = getSupabaseServerClient();

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
    let imported = 0;

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
      if (amountPence == null) continue;

      const description = get(mapping.description) || 'Imported transaction';
      const externalId = `csv:${input.filename}:${dateStr}:${description}:${amountPence}`;

      const { data: existing } = await client
        .from('finance_transactions')
        .select('id')
        .eq('account_id', input.accountId)
        .eq('external_id', externalId)
        .maybeSingle();

      if (existing?.id) continue;

      await client.from('finance_transactions').insert({
        account_id: input.accountId,
        bank_account_id: bankAccountId,
        transaction_date: dateStr,
        description,
        amount_pence: amountPence,
        source: 'csv',
        external_id: externalId,
        import_batch_id: batch?.id,
        sync_status: 'local',
        created_by: user.id,
      });
      imported++;
    }

    await client
      .from('finance_import_batches')
      .update({ imported_count: imported, status: 'imported' })
      .eq('id', batch!.id);

    revalidateFinances(input.accountSlug);
    return { imported, batchId: batch!.id };
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
    const { error } = await client.from('finance_transactions').insert({
      account_id: input.accountId,
      bank_account_id: input.bankAccountId,
      category_id: input.categoryId,
      transaction_date: input.transactionDate,
      description: input.description,
      amount_pence: input.amountPence,
      source: 'manual',
      sync_status: 'local',
      created_by: user.id,
    });
    if (error) throw error;
    revalidateFinances(input.accountSlug);
    return { ok: true };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      bankAccountId: z.string().uuid().nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
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
        .select('id, description, amount_pence, category_id')
        .eq('account_id', input.accountId)
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
