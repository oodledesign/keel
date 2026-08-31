import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomBytes } from 'node:crypto';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export type MetaDataDeletionStatus = 'received' | 'processed' | 'failed';

export type MetaDataDeletionRequest = {
  confirmation_code: string;
  status: MetaDataDeletionStatus;
  created_at: string;
  processed_at: string | null;
  deleted_ig_connections: number;
  deleted_feedflow_accounts: number;
  anonymised_comment_events: number;
};

export type ProcessMetaDataDeletionResult = {
  confirmationCode: string;
  status: MetaDataDeletionStatus;
  deletedIgConnections: number;
  deletedFeedflowAccounts: number;
  anonymisedCommentEvents: number;
};

type FeedflowSocialAccountMatch = {
  id: string;
  provider: string | null;
  platform: string | null;
};

type DeletionRequestsTable = {
  insert: (row: Record<string, unknown>) => PromiseLike<{
    error: { message: string } | null;
  }>;
  update: (row: Record<string, unknown>) => {
    eq: (
      column: string,
      value: string,
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      maybeSingle: () => PromiseLike<{
        data: MetaDataDeletionRequest | null;
        error: { message: string } | null;
      }>;
    };
  };
};

function deletionRequestsTable(client: SupabaseClient): DeletionRequestsTable {
  return client.from(
    'meta_data_deletion_requests' as never,
  ) as unknown as DeletionRequestsTable;
}

export function createConfirmationCode(): string {
  return randomBytes(16).toString('hex');
}

function isInstagramProvider(row: FeedflowSocialAccountMatch): boolean {
  const provider = (row.provider ?? '').toLowerCase();
  const platform = (row.platform ?? '').toLowerCase();
  return provider === 'instagram' || platform === 'instagram';
}

async function deleteAutoReplyConnections(
  client: SupabaseClient,
  metaUserId: string,
): Promise<number> {
  const { data, error } = await client
    .from('ig_connected_accounts')
    .select('id')
    .eq('ig_business_account_id', metaUserId);

  if (error) {
    throw new Error(error.message);
  }

  const ids = (data ?? [])
    .map((row) => (row as { id?: string }).id)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return 0;
  }

  const { error: deleteError } = await client
    .from('ig_connected_accounts')
    .delete()
    .in('id', ids);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  return ids.length;
}

async function anonymiseCommenterEvents(
  client: SupabaseClient,
  metaUserId: string,
): Promise<number> {
  const { data, error } = await client
    .from('ig_comment_events')
    .select('id')
    .eq('commenter_ig_id', metaUserId);

  if (error) {
    throw new Error(error.message);
  }

  const ids = (data ?? [])
    .map((row) => (row as { id?: string }).id)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return 0;
  }

  const { error: updateError } = await client
    .from('ig_comment_events')
    .update({
      commenter_ig_id: null,
      commenter_username: null,
      comment_text: null,
    })
    .in('id', ids);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return ids.length;
}

async function deleteFeedflowInstagramAccounts(
  client: SupabaseClient,
  metaUserId: string,
): Promise<number> {
  const feedflow = supabaseCustomSchema(client, 'feedflow');

  const [byPlatformUser, byExternal] = await Promise.all([
    feedflow
      .from('social_accounts')
      .select('id, provider, platform')
      .eq('platform_user_id', metaUserId),
    feedflow
      .from('social_accounts')
      .select('id, provider, platform')
      .eq('external_account_id', metaUserId),
  ]);

  if (byPlatformUser.error) {
    throw new Error(byPlatformUser.error.message);
  }

  if (byExternal.error) {
    throw new Error(byExternal.error.message);
  }

  const matches = new Map<string, FeedflowSocialAccountMatch>();

  for (const row of [
    ...(byPlatformUser.data ?? []),
    ...(byExternal.data ?? []),
  ] as FeedflowSocialAccountMatch[]) {
    if (row.id && isInstagramProvider(row)) {
      matches.set(row.id, row);
    }
  }

  const ids = [...matches.keys()];

  if (ids.length === 0) {
    return 0;
  }

  const { error } = await feedflow
    .from('social_accounts')
    .delete()
    .in('id', ids);

  if (error) {
    throw new Error(error.message);
  }

  return ids.length;
}

export function createMetaDataDeletionService(client: SupabaseClient) {
  return {
    async processForMetaUser(
      metaUserId: string,
      confirmationCode = createConfirmationCode(),
    ): Promise<ProcessMetaDataDeletionResult> {
      const table = deletionRequestsTable(client);
      const insertError = (
        await table.insert({
          confirmation_code: confirmationCode,
          meta_user_id: metaUserId,
          status: 'received',
        })
      ).error;

      if (insertError) {
        throw new Error(insertError.message);
      }

      try {
        const [
          deletedIgConnections,
          deletedFeedflowAccounts,
          anonymisedCommentEvents,
        ] = await Promise.all([
          deleteAutoReplyConnections(client, metaUserId),
          deleteFeedflowInstagramAccounts(client, metaUserId),
          anonymiseCommenterEvents(client, metaUserId),
        ]);

        const updateError = (
          await table
            .update({
              status: 'processed',
              deleted_ig_connections: deletedIgConnections,
              deleted_feedflow_accounts: deletedFeedflowAccounts,
              anonymised_comment_events: anonymisedCommentEvents,
              processed_at: new Date().toISOString(),
            })
            .eq('confirmation_code', confirmationCode)
        ).error;

        if (updateError) {
          throw new Error(updateError.message);
        }

        return {
          confirmationCode,
          status: 'processed',
          deletedIgConnections,
          deletedFeedflowAccounts,
          anonymisedCommentEvents,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown deletion error';

        await table
          .update({
            status: 'failed',
            error_message: message,
            processed_at: new Date().toISOString(),
          })
          .eq('confirmation_code', confirmationCode);

        return {
          confirmationCode,
          status: 'failed',
          deletedIgConnections: 0,
          deletedFeedflowAccounts: 0,
          anonymisedCommentEvents: 0,
        };
      }
    },

    async getByConfirmationCode(
      confirmationCode: string,
    ): Promise<MetaDataDeletionRequest | null> {
      const { data, error } = await deletionRequestsTable(client)
        .select(
          'confirmation_code, status, created_at, processed_at, deleted_ig_connections, deleted_feedflow_accounts, anonymised_comment_events',
        )
        .eq('confirmation_code', confirmationCode)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
  };
}
