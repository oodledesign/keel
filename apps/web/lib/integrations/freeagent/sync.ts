import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type FreeAgentCategoryRecord,
  freeAgentCategoryDisplayName,
  freeAgentCategoryKind,
} from './categories';
import {
  FreeAgentClient,
  freeAgentTransactionDate,
  parseFreeAgentId,
  poundsToPence,
} from './client';
import {
  buildCategoryUrlToIdMap,
  removeOzerDefaultCategories,
} from './finance-categories';

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

export type SyncFreeAgentMode = 'full' | 'incremental' | 'history';

export type SyncFreeAgentOptions = {
  mode?: SyncFreeAgentMode;
  /** YYYY-MM-DD — incremental mode defaults from last_sync_at. */
  fromDate?: string;
  /** Refresh FreeAgent categories even when mode is incremental (manual Sync now). */
  syncCategories?: boolean;
};

export type SyncFreeAgentResult = {
  imported: number;
  updated: number;
  processed: number;
  bankAccounts: number;
  categorised: number;
  categoriesSynced: number;
  mode: SyncFreeAgentMode;
  fromDate: string | null;
};

export type HistoryBackfillState = {
  status: 'idle' | 'running' | 'complete';
  bankAccountIndex: number;
  windowIndex: number;
  startedAt: string | null;
  completedAt: string | null;
  cumulativeImported: number;
  cumulativeUpdated: number;
  cumulativeProcessed: number;
};

export type SyncFreeAgentHistoryChunkResult = SyncFreeAgentResult & {
  historyComplete: boolean;
  historyProgress: string;
  historyBackfill: HistoryBackfillState;
};

type ConnectionSyncState = Record<string, unknown> & {
  historyBackfill?: HistoryBackfillState;
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

function explanationCategoryUrl(
  explanation: Record<string, unknown>,
): string | null {
  const category = explanation.category;
  if (typeof category === 'string' && category.trim()) {
    return category.trim();
  }
  return null;
}

async function fetchExplanationMapForBankAccount(
  client: FreeAgentClient,
  bankAccountUrl: string,
  options?: { fromDate?: string; toDate?: string; maxPages?: number },
): Promise<Map<string, FreeAgentExplanationSummary>> {
  const map = new Map<string, FreeAgentExplanationSummary>();
  const maxPages = options?.maxPages ?? 50;
  const unlimitedPages = maxPages <= 0;

  for (let page = 1; unlimitedPages || page <= maxPages; page++) {
    const explanations = await client.listTransactionExplanationsForBankAccount(
      bankAccountUrl,
      page,
      options?.fromDate || options?.toDate
        ? { fromDate: options.fromDate, toDate: options.toDate }
        : undefined,
    );
    if (explanations.length === 0) break;

    for (const explanation of explanations) {
      const bankTransactionUrl = String(
        explanation.bank_transaction ?? '',
      ).trim();
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
    await removeOzerDefaultCategories(db, accountId);
  }

  return synced;
}

function incrementalSyncFromDate(
  lastSyncAt: string | null | undefined,
): string {
  const today = new Date();
  const cap = new Date(today);
  cap.setDate(cap.getDate() - 90);

  let from = new Date(today);
  if (lastSyncAt) {
    from = new Date(lastSyncAt);
    from.setDate(from.getDate() - 2);
  } else {
    from.setDate(from.getDate() - 14);
  }

  if (from < cap) {
    from = cap;
  }

  return from.toISOString().slice(0, 10);
}

type DateWindow = { fromDate: string; toDate?: string };

type ImportStats = {
  imported: number;
  updated: number;
  processed: number;
  categorised: number;
};

function shiftDateYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Full sync covers the last two years of bank activity. */
function fullSyncFromDate(): string {
  return shiftDateYmd(new Date().toISOString().slice(0, 10), -730);
}

/** Year-by-year windows for deep historical backfill. */
function historyDateWindows(yearsBack = 20): DateWindow[] {
  const today = new Date().toISOString().slice(0, 10);
  const endYear = new Date().getFullYear();
  const startYear = endYear - yearsBack + 1;
  const windows: DateWindow[] = [];

  for (let year = startYear; year <= endYear; year++) {
    windows.push({
      fromDate: `${year}-01-01`,
      toDate: year === endYear ? today : `${year}-12-31`,
    });
  }

  return windows;
}

async function importBankTransactionsForWindow(
  db: SupabaseClient,
  input: {
    accountId: string;
    bankAccountId: string;
    client: FreeAgentClient;
    bankAccountUrl: string;
    categoryUrlToId: Map<string, string>;
    explanationMap: Map<string, FreeAgentExplanationSummary>;
    dateFilter?: DateWindow;
    maxPages: number;
  },
): Promise<ImportStats> {
  const stats: ImportStats = {
    imported: 0,
    updated: 0,
    processed: 0,
    categorised: 0,
  };

  const unlimitedPages = input.maxPages <= 0;

  for (let page = 1; unlimitedPages || page <= input.maxPages; page++) {
    const transactions = await input.client.listBankTransactions(
      input.bankAccountUrl,
      page,
      input.dateFilter?.fromDate || input.dateFilter?.toDate
        ? {
            fromDate: input.dateFilter.fromDate,
            toDate: input.dateFilter.toDate,
          }
        : undefined,
    );
    if (transactions.length === 0) break;

    for (const tx of transactions) {
      const txUrl = String(tx.url ?? '');
      const txId = parseFreeAgentId(txUrl);
      if (!txUrl || !txId) continue;

      stats.processed++;

      const amountPence = poundsToPence(tx.amount as string | number);
      const dated = freeAgentTransactionDate(tx);
      if (!dated) continue;

      const description = String(
        tx.description ?? tx.full_description ?? tx.comment ?? '',
      );

      const faExplanation = input.explanationMap.get(txUrl);
      const categoryId =
        faExplanation?.categoryUrl != null
          ? (input.categoryUrlToId.get(faExplanation.categoryUrl) ?? null)
          : null;

      const { data: existingTx } = await db
        .from('finance_transactions')
        .select('id, category_id, freeagent_explanation_url, sync_status')
        .eq('account_id', input.accountId)
        .eq('freeagent_transaction_url', txUrl)
        .maybeSingle();

      const preserveLocalCategory =
        existingTx?.sync_status === 'pending_push' ||
        existingTx?.sync_status === 'local';

      const payload = {
        account_id: input.accountId,
        bank_account_id: input.bankAccountId,
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
            bank_account_id: input.bankAccountId,
            freeagent_explanation_url: payload.freeagent_explanation_url,
            category_id: payload.category_id,
            sync_status: payload.sync_status,
            sync_error: null,
          })
          .eq('id', existingTx.id);

        stats.updated++;
        if (categoryId && !preserveLocalCategory) stats.categorised++;
      } else {
        await db.from('finance_transactions').insert(payload);
        stats.imported++;
        if (categoryId) stats.categorised++;
      }
    }

    if (transactions.length < 100) break;
  }

  return stats;
}

function readConnectionSyncState(connection: {
  sync_state?: unknown;
}): ConnectionSyncState {
  const raw = connection.sync_state;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw as ConnectionSyncState;
}

function initialHistoryBackfillState(): HistoryBackfillState {
  return {
    status: 'running',
    bankAccountIndex: 0,
    windowIndex: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    cumulativeImported: 0,
    cumulativeUpdated: 0,
    cumulativeProcessed: 0,
  };
}

async function ensureFinanceBankAccount(
  db: SupabaseClient,
  accountId: string,
  ba: Record<string, unknown>,
): Promise<string | null> {
  const baUrl = String(ba.url ?? '');
  const baId = parseFreeAgentId(baUrl);
  if (!baUrl) return null;

  const { data: bankRow } = await db
    .from('finance_bank_accounts')
    .select('id')
    .eq('account_id', accountId)
    .eq('freeagent_bank_account_url', baUrl)
    .maybeSingle();

  if (bankRow?.id) {
    await db
      .from('finance_bank_accounts')
      .update({
        name: String(ba.name ?? ba.bank_name ?? 'Bank account'),
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', bankRow.id);
    return bankRow.id as string;
  }

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

  return (inserted?.id as string | undefined) ?? null;
}

export async function syncFreeAgentHistoryChunk(
  db: SupabaseClient,
  accountId: string,
  options: { reset?: boolean } = {},
): Promise<SyncFreeAgentHistoryChunkResult> {
  const { data: connection, error } = await db
    .from('finance_connections')
    .select('*')
    .eq('account_id', accountId)
    .eq('provider', 'freeagent')
    .maybeSingle();

  if (error) throw error;
  if (!connection) throw new Error('FreeAgent is not connected');

  const client = clientFromConnection(db, connection as ConnectionRow);
  const syncState = readConnectionSyncState(connection);
  const windows = historyDateWindows();

  const historyBackfill =
    options.reset || syncState.historyBackfill?.status !== 'running'
      ? initialHistoryBackfillState()
      : { ...syncState.historyBackfill! };

  const faBankAccounts = await client.listBankAccounts();
  const totalSteps = Math.max(faBankAccounts.length * windows.length, 1);

  if (historyBackfill.status === 'complete' && !options.reset) {
    return {
      imported: 0,
      updated: 0,
      processed: 0,
      bankAccounts: faBankAccounts.length,
      categorised: 0,
      categoriesSynced: 0,
      mode: 'history',
      fromDate: null,
      historyComplete: true,
      historyProgress: 'Historical sync already complete',
      historyBackfill,
    };
  }

  let categoriesSynced = 0;
  if (
    options.reset ||
    (historyBackfill.bankAccountIndex === 0 &&
      historyBackfill.windowIndex === 0)
  ) {
    categoriesSynced = await syncFreeAgentCategories(db, accountId, client);
  }
  const categoryUrlToId = await buildCategoryUrlToIdMap(db, accountId);

  let imported = 0;
  let updated = 0;
  let processed = 0;
  let categorised = 0;
  let historyProgress = 'Preparing historical sync';
  let historyComplete = false;

  while (historyBackfill.bankAccountIndex < faBankAccounts.length) {
    const ba = faBankAccounts[historyBackfill.bankAccountIndex]!;
    const baUrl = String(ba.url ?? '');
    if (!baUrl) {
      historyBackfill.bankAccountIndex++;
      historyBackfill.windowIndex = 0;
      continue;
    }

    if (historyBackfill.windowIndex >= windows.length) {
      historyBackfill.bankAccountIndex++;
      historyBackfill.windowIndex = 0;
      continue;
    }

    const window = windows[historyBackfill.windowIndex]!;
    const bankAccountId = await ensureFinanceBankAccount(db, accountId, ba);
    if (!bankAccountId) {
      historyBackfill.windowIndex++;
      continue;
    }

    const accountLabel = String(ba.name ?? ba.bank_name ?? 'Bank account');
    const yearLabel = window.fromDate.slice(0, 4);
    const step =
      historyBackfill.bankAccountIndex * windows.length +
      historyBackfill.windowIndex +
      1;
    historyProgress = `${yearLabel} · ${accountLabel} (${step}/${totalSteps})`;

    const explanationMap = await fetchExplanationMapForBankAccount(
      client,
      baUrl,
      {
        fromDate: window.fromDate,
        toDate: window.toDate,
        maxPages: 0,
      },
    );

    const stats = await importBankTransactionsForWindow(db, {
      accountId,
      bankAccountId,
      client,
      bankAccountUrl: baUrl,
      categoryUrlToId,
      explanationMap,
      dateFilter: window,
      maxPages: 0,
    });

    imported += stats.imported;
    updated += stats.updated;
    processed += stats.processed;
    categorised += stats.categorised;

    historyBackfill.cumulativeImported += stats.imported;
    historyBackfill.cumulativeUpdated += stats.updated;
    historyBackfill.cumulativeProcessed += stats.processed;
    historyBackfill.windowIndex++;

    break;
  }

  if (historyBackfill.bankAccountIndex >= faBankAccounts.length) {
    historyBackfill.status = 'complete';
    historyBackfill.completedAt = new Date().toISOString();
    historyComplete = true;
    historyProgress = `Complete — ${historyBackfill.cumulativeImported} new, ${historyBackfill.cumulativeUpdated} updated`;
  } else {
    historyBackfill.status = 'running';
  }

  await db
    .from('finance_connections')
    .update({
      last_sync_at: new Date().toISOString(),
      sync_state: {
        ...syncState,
        lastMode: 'history',
        lastFromDate: null,
        lastCronError: null,
        historyBackfill,
      },
    })
    .eq('id', connection.id);

  return {
    imported,
    updated,
    processed,
    bankAccounts: faBankAccounts.length,
    categorised,
    categoriesSynced,
    mode: 'history',
    fromDate: null,
    historyComplete,
    historyProgress,
    historyBackfill,
  };
}

export async function syncFreeAgentToOzer(
  db: SupabaseClient,
  accountId: string,
  options: SyncFreeAgentOptions = {},
): Promise<SyncFreeAgentResult> {
  const mode = options.mode ?? 'full';
  const isIncremental = mode === 'incremental';
  const isHistory = mode === 'history';
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

  const fromDate = isIncremental
    ? (options.fromDate ??
      incrementalSyncFromDate(connection.last_sync_at as string | null))
    : isHistory
      ? null
      : fullSyncFromDate();

  let categoriesSynced = 0;
  if (!isIncremental || options.syncCategories) {
    categoriesSynced = await syncFreeAgentCategories(db, accountId, client);
  }
  const categoryUrlToId = await buildCategoryUrlToIdMap(db, accountId);

  const faBankAccounts = await client.listBankAccounts();
  let imported = 0;
  let updated = 0;
  let processed = 0;
  let categorised = 0;

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

    const windows: DateWindow[] = isHistory
      ? historyDateWindows()
      : [{ fromDate: fromDate ?? fullSyncFromDate(), toDate: undefined }];

    for (const window of windows) {
      const explanationMap = await fetchExplanationMapForBankAccount(
        client,
        baUrl,
        isIncremental
          ? {
              fromDate: window.fromDate,
              toDate: window.toDate,
              maxPages: 5,
            }
          : {
              fromDate: window.fromDate,
              toDate: window.toDate,
              maxPages: isHistory ? 100 : 50,
            },
      );

      const stats = await importBankTransactionsForWindow(db, {
        accountId,
        bankAccountId,
        client,
        bankAccountUrl: baUrl,
        categoryUrlToId,
        explanationMap,
        dateFilter: window,
        maxPages: isIncremental ? 5 : isHistory ? 100 : 50,
      });

      imported += stats.imported;
      updated += stats.updated;
      processed += stats.processed;
      categorised += stats.categorised;
    }

    await db
      .from('finance_bank_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', bankAccountId);
  }

  await db
    .from('finance_connections')
    .update({
      last_sync_at: new Date().toISOString(),
      sync_state: {
        ...readConnectionSyncState(connection),
        lastMode: mode,
        lastFromDate: fromDate,
        lastCronError: null,
      },
    })
    .eq('id', connection.id);

  return {
    imported,
    updated,
    processed,
    bankAccounts: faBankAccounts.length,
    categorised,
    categoriesSynced,
    mode,
    fromDate,
  };
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

  if (txError || !tx?.freeagent_transaction_url || !tx.category_id)
    return false;

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
      description: tx.description || 'Categorised in Ozer',
      gross_value: grossValue,
      dated_on: String(
        tx.transaction_date ?? new Date().toISOString().slice(0, 10),
      ),
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
