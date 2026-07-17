import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  decryptGoogleSecret,
  encryptGoogleSecret,
} from '~/lib/integrations/google-calendar/crypto';

import { StarlingClient } from './client';

type ConnectionRow = {
  id: string;
  account_id: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string;
  sync_state: Record<string, unknown> | null;
  last_sync_at: string | null;
};

export type SyncStarlingMode = 'full' | 'incremental';

export type SyncStarlingOptions = {
  mode?: SyncStarlingMode;
};

export type SyncStarlingResult = {
  imported: number;
  bankAccounts: number;
  mode: SyncStarlingMode;
  fromDate: string;
};

async function saveEncryptedTokens(
  db: SupabaseClient,
  connectionId: string,
  tokens: { accessToken: string; refreshToken: string; expiresAt: Date },
) {
  await db
    .from('finance_connections')
    .update({
      access_token_encrypted: encryptGoogleSecret(tokens.accessToken),
      refresh_token_encrypted: encryptGoogleSecret(tokens.refreshToken),
      token_expires_at: tokens.expiresAt.toISOString(),
    })
    .eq('id', connectionId);
}

function tokensFromConnection(row: ConnectionRow) {
  if (!row.access_token_encrypted || !row.refresh_token_encrypted) {
    throw new Error('Starling tokens are missing');
  }

  return {
    accessToken: decryptGoogleSecret(row.access_token_encrypted),
    refreshToken: decryptGoogleSecret(row.refresh_token_encrypted),
  };
}

function clientFromConnection(db: SupabaseClient, row: ConnectionRow) {
  const tokens = tokensFromConnection(row);
  return new StarlingClient(
    tokens.accessToken,
    async (refreshed) => saveEncryptedTokens(db, row.id, refreshed),
    tokens.refreshToken,
    new Date(row.token_expires_at),
  );
}

function incrementalSyncFromDate(lastSyncAt: string | null | undefined): Date {
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

  if (from < cap) from = cap;
  return from;
}

function feedItemDescription(item: {
  counterPartyName?: string;
  reference?: string;
  source?: string;
}) {
  const parts = [
    item.counterPartyName?.trim(),
    item.reference?.trim(),
    item.source?.trim(),
  ].filter(Boolean);
  return parts.join(' · ') || 'Starling transaction';
}

function feedItemDate(item: {
  settlementTime?: string;
  transactionTime?: string;
}) {
  const raw = item.settlementTime ?? item.transactionTime;
  if (!raw) return null;
  return raw.slice(0, 10);
}

export async function syncStarlingToOzer(
  db: SupabaseClient,
  accountId: string,
  options: SyncStarlingOptions = {},
): Promise<SyncStarlingResult> {
  const mode = options.mode ?? 'full';
  const isIncremental = mode === 'incremental';

  const { data: connection, error } = await db
    .from('finance_connections')
    .select('*')
    .eq('account_id', accountId)
    .eq('provider', 'starling')
    .maybeSingle();

  if (error) throw error;
  if (!connection) throw new Error('Starling is not connected');

  const client = clientFromConnection(db, connection as ConnectionRow);
  const accounts = await client.listAccounts();

  const fromDate = incrementalSyncFromDate(
    connection.last_sync_at as string | null,
  );
  const toDate = new Date();
  const minTimestamp = fromDate.toISOString();
  const maxTimestamp = toDate.toISOString();

  let imported = 0;

  for (const account of accounts) {
    const accountUid = account.accountUid;
    const categoryUid = account.defaultCategory;
    if (!accountUid || !categoryUid) continue;

    const { data: bankRow } = await db
      .from('finance_bank_accounts')
      .select('id')
      .eq('account_id', accountId)
      .eq('starling_account_uid', accountUid)
      .eq('starling_category_uid', categoryUid)
      .maybeSingle();

    let bankAccountId = bankRow?.id as string | undefined;
    const bankName = account.name?.trim() || 'Starling account';

    if (!bankAccountId) {
      const { data: inserted } = await db
        .from('finance_bank_accounts')
        .insert({
          account_id: accountId,
          name: bankName,
          currency: String(account.currency ?? 'GBP').toUpperCase(),
          source: 'starling',
          starling_account_uid: accountUid,
          starling_category_uid: categoryUid,
        })
        .select('id')
        .single();
      bankAccountId = inserted?.id as string;
    } else {
      await db
        .from('finance_bank_accounts')
        .update({
          name: bankName,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', bankAccountId);
    }

    if (!bankAccountId) continue;

    const feedItems = await client.listTransactionsBetween(
      accountUid,
      categoryUid,
      minTimestamp,
      maxTimestamp,
    );

    for (const item of feedItems) {
      const feedItemUid = item.feedItemUid;
      if (!feedItemUid) continue;

      const dated = feedItemDate(item);
      if (!dated) continue;

      const amountPence = Number(item.amount?.minorUnits ?? 0);
      const description = feedItemDescription(item);
      const externalId = `starling:${feedItemUid}`;

      const { data: existingTx } = await db
        .from('finance_transactions')
        .select('id')
        .eq('account_id', accountId)
        .eq('external_id', externalId)
        .maybeSingle();

      const payload = {
        account_id: accountId,
        bank_account_id: bankAccountId,
        transaction_date: dated,
        description,
        amount_pence: amountPence,
        currency: String(item.amount?.currency ?? 'GBP').toUpperCase(),
        source: 'starling' as const,
        external_id: externalId,
        sync_status: 'synced' as const,
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
          })
          .eq('id', existingTx.id);
      } else {
        await db.from('finance_transactions').insert(payload);
        imported++;
      }
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
        ...(connection.sync_state as Record<string, unknown> | null),
        lastMode: mode,
        lastFromDate: fromDate.toISOString().slice(0, 10),
        accountCount: accounts.length,
        lastCronError: null,
      },
    })
    .eq('id', connection.id);

  return {
    imported,
    bankAccounts: accounts.length,
    mode,
    fromDate: fromDate.toISOString().slice(0, 10),
  };
}
