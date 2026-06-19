import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

type ThreadType = 'direct' | 'group' | 'job';

export function createMessagesAccessService(client: SupabaseClient) {
  return new MessagesAccessService(client);
}

class MessagesAccessService {
  constructor(private readonly client: SupabaseClient) {}

  async assertAccountMember(accountId: string, userId: string) {
    const { data, error } = await this.client
      .from('accounts_memberships')
      .select('user_id, account_role')
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      throw new Error('You do not have access to this account');
    }

    return data as { user_id: string; account_role: string | null };
  }

  async assertThreadParticipant(threadId: string, userId: string) {
    const { data } = await this.client
      .from('chat_thread_participants')
      .select('id')
      .eq('thread_id', threadId)
      .eq('participant_user_id', userId)
      .is('archived_at', null)
      .maybeSingle();

    if (!data) {
      throw new Error('You are not a participant in this thread');
    }
  }

  async validateThreadCreation(params: {
    accountId: string;
    creatorUserId: string;
    type: ThreadType;
    jobId?: string | null;
    memberUserIds: string[];
    clientIds: string[];
  }) {
    await this.assertAccountMember(params.accountId, params.creatorUserId);

    const dedupMemberIds = Array.from(new Set(params.memberUserIds));
    const dedupClientIds = Array.from(new Set(params.clientIds));

    if (params.type === 'direct') {
      const total = dedupMemberIds.length + dedupClientIds.length;
      if (total !== 2) {
        throw new Error('Direct chats require exactly two participants');
      }
    }

    if (params.type === 'job' && !params.jobId) {
      throw new Error('Job chats require a linked job');
    }

    if (dedupMemberIds.length > 0) {
      const { data: members, error } = await this.client
        .from('accounts_memberships')
        .select('user_id')
        .eq('account_id', params.accountId)
        .in('user_id', dedupMemberIds);

      if (error) throw error;

      if ((members ?? []).length !== dedupMemberIds.length) {
        throw new Error('One or more selected team members are not in this business');
      }
    }

    if (dedupClientIds.length > 0) {
      const { data: clients, error } = await this.client
        .from('clients')
        .select('id')
        .eq('account_id', params.accountId)
        .in('id', dedupClientIds);

      if (error) throw error;

      if ((clients ?? []).length !== dedupClientIds.length) {
        throw new Error('One or more selected clients are not in this business');
      }
    }

    if (params.jobId) {
      const { data: job, error } = await this.client
        .from('jobs')
        .select('id')
        .eq('id', params.jobId)
        .eq('account_id', params.accountId)
        .maybeSingle();

      if (error) throw error;
      if (!job) throw new Error('Job not found in this business');
    }
  }

  async assertThreadClientsNotArchived(_threadId: string) {
    // Ozer clients do not use archived_at yet; no-op for compatibility.
  }
}
