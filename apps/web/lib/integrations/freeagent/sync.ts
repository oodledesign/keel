import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  FreeAgentClient,
  parseFreeAgentId,
  poundsToPence,
} from './client';

type ConnectionRow = {
  id: string;
  account_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  freeagent_company_url: string | null;
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

function categoryKindFromFreeAgent(cat: Record<string, unknown>): 'income' | 'expense' {
  const group = String(cat.group ?? cat.category_group ?? '').toLowerCase();
  if (group.includes('income') || group.includes('sales')) return 'income';
  return 'expense';
}

export async function syncFreeAgentToKeel(
  db: SupabaseClient,
  accountId: string,
): Promise<{ imported: number; bankAccounts: number }> {
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

  const faCategories = await client.listCategories();
  for (const cat of faCategories) {
    const url = String(cat.url ?? '');
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
      name: String(cat.name ?? cat.description ?? 'Category'),
      kind: categoryKindFromFreeAgent(cat),
      freeagent_category_url: url,
      freeagent_category_id: faId,
    };

    if (existing?.id) {
      await db.from('finance_categories').update(payload).eq('id', existing.id);
    } else {
      await db.from('finance_categories').insert(payload);
    }
  }

  const faBankAccounts = await client.listBankAccounts();
  let imported = 0;

  for (const ba of faBankAccounts) {
    const baUrl = String(ba.url ?? '');
    const baId = parseFreeAgentId(baUrl);
    if (!baUrl) continue;

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

        const { data: existingTx } = await db
          .from('finance_transactions')
          .select('id, category_id, freeagent_explanation_url')
          .eq('account_id', accountId)
          .eq('freeagent_transaction_url', txUrl)
          .maybeSingle();

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
          sync_status: 'synced' as const,
        };

        if (existingTx?.id) {
          await db
            .from('finance_transactions')
            .update({
              transaction_date: payload.transaction_date,
              description: payload.description,
              amount_pence: payload.amount_pence,
              bank_account_id: bankAccountId,
            })
            .eq('id', existingTx.id);
        } else {
          await db.from('finance_transactions').insert(payload);
          imported++;
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

  return { imported, bankAccounts: faBankAccounts.length };
}

export async function pushCategoryToFreeAgent(
  db: SupabaseClient,
  accountId: string,
  transactionId: string,
): Promise<void> {
  const { data: connection } = await db
    .from('finance_connections')
    .select('*')
    .eq('account_id', accountId)
    .eq('provider', 'freeagent')
    .maybeSingle();

  if (!connection) return;

  const { data: tx, error: txError } = await db
    .from('finance_transactions')
    .select(
      'id, amount_pence, description, freeagent_transaction_url, freeagent_explanation_url, category_id',
    )
    .eq('id', transactionId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (txError || !tx?.freeagent_transaction_url || !tx.category_id) return;

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
    return;
  }

  const client = clientFromConnection(db, connection as ConnectionRow);
  const grossValue = (tx.amount_pence / 100).toFixed(2);

  try {
    const body = {
      bank_transaction: tx.freeagent_transaction_url,
      category: category.freeagent_category_url,
      description: tx.description || 'Categorised in Keel',
      gross_value: grossValue,
      dated_on: new Date().toISOString().slice(0, 10),
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
      return;
    }

    await db
      .from('finance_transactions')
      .update({ sync_status: 'synced', sync_error: null })
      .eq('id', transactionId);
  } catch (err) {
    await db
      .from('finance_transactions')
      .update({
        sync_status: 'push_failed',
        sync_error: err instanceof Error ? err.message : 'Sync failed',
      })
      .eq('id', transactionId);
    throw err;
  }
}
