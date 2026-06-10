import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  FreeAgentClient,
  parseFreeAgentId,
  poundsToPence,
} from './client';
import {
  buildCategoryUrlToIdMap,
  removeKeelDefaultCategories,
} from './finance-categories';
import {
  freeAgentCategoryDisplayName,
  freeAgentCategoryKind,
  type FreeAgentCategoryRecord,
} from './categories';

type ConnectionRow = {
  id: string;
  account_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  freeagent_company_url: string | null;
};

type FreeAgentExplanationSummary = {
  explanationUrl: string;
  categoryUrl: string | null;
};

async function saveTokens(
  db: SupabaseClient,
  connectionId: string,
  tokens: { accessToken: string; refreshToken: string; expiresAt: Date },
) {
  await db
    .from('finance_connections')
    .update({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: tokens.expiresAt.toISOString(),
    })
    .eq('id', connectionId);
}

function clientFromConnection(db: SupabaseClient, row: ConnectionRow) {
  return new FreeAgentClient(
    row.access_token,
    async (tokens) => saveTokens(db, row.id, tokens),
    row.refresh_token,
    new Date(row.token_expires_at),
  );
}

function explanationCategoryUrl(explanation: Record<string, unknown>): string | null {
  const category = explanation.category;
  if (typeof category === 'string' && category.trim()) {
    return category.trim();
  }
  return null;
}

async function fetchExplanationMapForBankAccount(
  client: FreeAgentClient,
  bankAccountUrl: string,
): Promise<Map<string, FreeAgentExplanationSummary>> {
  const map = new Map<string, FreeAgentExplanationSummary>();

  for (let page = 1; page <= 50; page++) {
    const explanations = await client.listTransactionExplanationsForBankAccount(
      bankAccountUrl,
      page,
    );
    if (explanations.length === 0) break;

    for (const explanation of explanations) {
      const bankTransactionUrl = String(explanation.bank_transaction ?? '').trim();
      const explanationUrl = String(explanation.url ?? '').trim();
      if (!bankTransactionUrl || !explanationUrl) continue;

      const categoryUrl = explanationCategoryUrl(explanation);
      const existing = map.get(bankTransactionUrl);

      if (!existing) {
        map.set(bankTransactionUrl, { explanationUrl, categoryUrl });
        continue;
      }

      // Prefer an explanation that carries an explicit category.
      if (!existing.categoryUrl && categoryUrl) {
        map.set(bankTransactionUrl, { explanationUrl, categoryUrl });
      }
    }

    if (explanations.length < 100) break;
  }

  return map;
}

async function syncFreeAgentCategories(
  db: SupabaseClient,
  accountId: string,
  client: FreeAgentClient,
): Promise<number> {
  const faCategories = await client.listCategories();
  let synced = 0;

  for (const cat of faCategories) {
    const record = cat as FreeAgentCategoryRecord;
    const url = String(record.url ?? '');
    const faId = parseFreeAgentId(url);
    if (!url || !faId) continue;

    const { data: existing } = await db
      .from('finance_categories')
      .select('id')
      .eq('account_id', accountId)
      .eq('freeagent_category_url', url)
      .maybeSingle();

    const payload = {
      account_id: accountId,
      name: freeAgentCategoryDisplayName(record),
      kind: freeAgentCategoryKind(record),
      freeagent_category_url: url,
      freeagent_category_id: faId,
      is_system: false,
    };

    if (existing?.id) {
      await db.from('finance_categories').update(payload).eq('id', existing.id);
    } else {
      await db.from('finance_categories').insert(payload);
    }
    synced++;
  }

  if (synced > 0) {
    await removeKeelDefaultCategories(db, accountId);
  }

  return synced;
}

export async function syncFreeAgentToKeel(
  db: SupabaseClient,
  accountId: string,
): Promise<{ imported: number; bankAccounts: number; categorised: number; categoriesSynced: number }> {
  const { data: connection, error } = await db
    .from('finance_connections')
    .select('*')
    .eq('account_id', accountId)
    .eq('provider', 'freeagent')
    .maybeSingle();

  if (error) throw error;
  if (!connection) throw new Error('FreeAgent is not connected');

  const client = clientFromConnection(db, connection as ConnectionRow);
  const companyRes = await client.getCompany();
  const company = companyRes.company;
  const companyUrl = String(company.url ?? '');

  await db
    .from('finance_connections')
    .update({
      freeagent_company_url: companyUrl,
      freeagent_company_name: String(company.name ?? 'FreeAgent'),
    })
    .eq('id', connection.id);

  const categoriesSynced = await syncFreeAgentCategories(db, accountId, client);
  const categoryUrlToId = await buildCategoryUrlToIdMap(db, accountId);

  const faBankAccounts = await client.listBankAccounts();
  let imported = 0;
  let categorised = 0;

  for (const ba of faBankAccounts) {
    const baUrl = String(ba.url ?? '');
    const baId = parseFreeAgentId(baUrl);
    if (!baUrl) continue;

    const explanationMap = await fetchExplanationMapForBankAccount(client, baUrl);

    const { data: bankRow } = await db
      .from('finance_bank_accounts')
      .select('id')
      .eq('account_id', accountId)
      .eq('freeagent_bank_account_url', baUrl)
      .maybeSingle();

    let bankAccountId = bankRow?.id as string | undefined;
    if (!bankAccountId) {
      const { data: inserted } = await db
        .from('finance_bank_accounts')
        .insert({
          account_id: accountId,
          name: String(ba.name ?? ba.bank_name ?? 'Bank account'),
          currency: String(ba.currency ?? 'GBP').toUpperCase(),
          source: 'freeagent',
          freeagent_bank_account_url: baUrl,
          freeagent_bank_account_id: baId,
        })
        .select('id')
        .single();
      bankAccountId = inserted?.id as string;
    } else {
      await db
        .from('finance_bank_accounts')
        .update({
          name: String(ba.name ?? ba.bank_name ?? 'Bank account'),
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', bankAccountId);
    }

    if (!bankAccountId) continue;

    for (let page = 1; page <= 20; page++) {
      const transactions = await client.listBankTransactions(baUrl, page);
      if (transactions.length === 0) break;

      for (const tx of transactions) {
        const txUrl = String(tx.url ?? '');
        const txId = parseFreeAgentId(txUrl);
        if (!txUrl || !txId) continue;

        const amountPence = poundsToPence(tx.amount as string | number);
        const dated = String(tx.dated ?? tx.created_at ?? '').slice(0, 10);
        if (!dated) continue;

        const description = String(
          tx.description ?? tx.full_description ?? tx.comment ?? '',
        );

        const faExplanation = explanationMap.get(txUrl);
        const categoryId =
          faExplanation?.categoryUrl != null
            ? (categoryUrlToId.get(faExplanation.categoryUrl) ?? null)
            : null;

        const { data: existingTx } = await db
          .from('finance_transactions')
          .select('id, category_id, freeagent_explanation_url, sync_status')
          .eq('account_id', accountId)
          .eq('freeagent_transaction_url', txUrl)
          .maybeSingle();

        const preserveLocalCategory =
          existingTx?.sync_status === 'pending_push' ||
          existingTx?.sync_status === 'local';

        const payload = {
          account_id: accountId,
          bank_account_id: bankAccountId,
          transaction_date: dated,
          description,
          amount_pence: amountPence,
          currency: String(tx.currency ?? 'GBP').toUpperCase(),
          source: 'freeagent' as const,
          external_id: `freeagent:${txId}`,
          freeagent_transaction_url: txUrl,
          freeagent_explanation_url: faExplanation?.explanationUrl ?? null,
          category_id:
            preserveLocalCategory && existingTx?.category_id
              ? existingTx.category_id
              : categoryId,
          sync_status:
            preserveLocalCategory && existingTx?.category_id
              ? existingTx.sync_status
              : categoryId
                ? ('synced' as const)
                : ('synced' as const),
          sync_error: null,
        };

        if (existingTx?.id) {
          await db
            .from('finance_transactions')
            .update({
              transaction_date: payload.transaction_date,
              description: payload.description,
              amount_pence: payload.amount_pence,
              bank_account_id: bankAccountId,
              freeagent_explanation_url: payload.freeagent_explanation_url,
              category_id: payload.category_id,
              sync_status: payload.sync_status,
              sync_error: null,
            })
            .eq('id', existingTx.id);

          if (categoryId && !preserveLocalCategory) categorised++;
        } else {
          await db.from('finance_transactions').insert(payload);
          imported++;
          if (categoryId) categorised++;
        }
      }

      if (transactions.length < 100) break;
    }

    await db
      .from('finance_bank_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', bankAccountId);
  }

  await db
    .from('finance_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', connection.id);

  return { imported, bankAccounts: faBankAccounts.length, categorised, categoriesSynced };
}

export async function pushCategoryToFreeAgent(
  db: SupabaseClient,
  accountId: string,
  transactionId: string,
): Promise<boolean> {
  const { data: connection } = await db
    .from('finance_connections')
    .select('*')
    .eq('account_id', accountId)
    .eq('provider', 'freeagent')
    .maybeSingle();

  if (!connection) return false;

  const { data: tx, error: txError } = await db
    .from('finance_transactions')
    .select(
      'id, amount_pence, description, transaction_date, freeagent_transaction_url, freeagent_explanation_url, category_id',
    )
    .eq('id', transactionId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (txError || !tx?.freeagent_transaction_url || !tx.category_id) return false;

  const { data: category } = await db
    .from('finance_categories')
    .select('freeagent_category_url')
    .eq('id', tx.category_id)
    .maybeSingle();

  if (!category?.freeagent_category_url) {
    await db
      .from('finance_transactions')
      .update({
        sync_status: 'local',
        sync_error: 'Category is not linked to FreeAgent',
      })
      .eq('id', transactionId);
    return false;
  }

  const client = clientFromConnection(db, connection as ConnectionRow);
  const grossValue = (tx.amount_pence / 100).toFixed(2);

  try {
    const body = {
      bank_transaction: tx.freeagent_transaction_url,
      category: category.freeagent_category_url,
      description: tx.description || 'Categorised in Keel',
      gross_value: grossValue,
      dated_on: String(tx.transaction_date ?? new Date().toISOString().slice(0, 10)),
    };

    if (tx.freeagent_explanation_url) {
      await client.updateTransactionExplanation(
        tx.freeagent_explanation_url,
        body,
      );
    } else {
      const res = await client.createTransactionExplanation(body);
      const explanationUrl = String(
        res.bank_transaction_explanation?.url ?? '',
      );
      await db
        .from('finance_transactions')
        .update({
          freeagent_explanation_url: explanationUrl || null,
          sync_status: 'synced',
          sync_error: null,
        })
        .eq('id', transactionId);
      return true;
    }

    await db
      .from('finance_transactions')
      .update({ sync_status: 'synced', sync_error: null })
      .eq('id', transactionId);
    return true;
  } catch (err) {
    await db
      .from('finance_transactions')
      .update({
        sync_status: 'push_failed',
        sync_error: err instanceof Error ? err.message : 'Sync failed',
      })
      .eq('id', transactionId);
    return false;
  }
}
