import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadContactIdsForUser } from './messages-participants';

type ThreadComposeType = 'direct' | 'group' | 'job' | 'client';

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
    const { data: byUser } = await this.client
      .from('chat_thread_participants')
      .select('id')
      .eq('thread_id', threadId)
      .eq('participant_user_id', userId)
      .is('archived_at', null)
      .maybeSingle();

    if (byUser) return;

    const contactIds = await loadContactIdsForUser(this.client, userId);
    if (contactIds.length === 0) {
      throw new Error('You are not a participant in this thread');
    }

    const { data: byContact } = await this.client
      .from('chat_thread_participants')
      .select('id')
      .eq('thread_id', threadId)
      .in('participant_contact_id', contactIds)
      .is('archived_at', null)
      .limit(1)
      .maybeSingle();

    if (!byContact) {
      throw new Error('You are not a participant in this thread');
    }
  }

  async validateThreadCreation(params: {
    accountId: string;
    creatorUserId: string;
    type: ThreadComposeType;
    jobId?: string | null;
    clientId?: string | null;
    memberUserIds: string[];
    clientIds: string[];
    contactIds: string[];
  }) {
    await this.assertAccountMember(params.accountId, params.creatorUserId);

    const otherMemberIds = Array.from(
      new Set(params.memberUserIds.filter((id) => id !== params.creatorUserId)),
    );
    const dedupClientIds = Array.from(new Set(params.clientIds));
    const dedupContactIds = Array.from(new Set(params.contactIds));

    if (params.type === 'direct') {
      const others = otherMemberIds.length + dedupContactIds.length;
      if (others !== 1 || dedupClientIds.length > 0) {
        throw new Error(
          'Direct chats need exactly one other person — a teammate or a contact',
        );
      }
    }

    if (params.type === 'group') {
      if (otherMemberIds.length + dedupContactIds.length < 1) {
        throw new Error('Add at least one other participant');
      }
    }

    if (params.type === 'client') {
      if (!params.clientId) {
        throw new Error('Choose a client for a whole-client chat');
      }
    }

    if (params.type === 'job' && !params.jobId) {
      throw new Error('Job chats require a linked job');
    }

    if (otherMemberIds.length > 0) {
      const { data: members, error } = await this.client
        .from('accounts_memberships')
        .select('user_id')
        .eq('account_id', params.accountId)
        .in('user_id', otherMemberIds);

      if (error) throw error;

      if ((members ?? []).length !== otherMemberIds.length) {
        throw new Error(
          'One or more selected team members are not in this business',
        );
      }
    }

    if (dedupClientIds.length > 0 || params.clientId) {
      const ids = Array.from(
        new Set([...dedupClientIds, params.clientId].filter(Boolean)),
      ) as string[];
      const { data: clients, error } = await this.client
        .from('clients')
        .select('id')
        .eq('account_id', params.accountId)
        .in('id', ids);

      if (error) throw error;

      if ((clients ?? []).length !== ids.length) {
        throw new Error(
          'One or more selected clients are not in this business',
        );
      }
    }

    if (dedupContactIds.length > 0) {
      const { data: links, error } = await this.client
        .from('client_contacts')
        .select('contact_id, clients!inner ( id, account_id )')
        .in('contact_id', dedupContactIds);

      if (error) throw error;

      const valid = new Set(
        ((links ?? []) as Array<Record<string, unknown>>)
          .filter((row) => {
            const related = row.clients as
              | { account_id?: string }
              | Array<{ account_id?: string }>
              | null;
            const accountId = Array.isArray(related)
              ? related[0]?.account_id
              : related?.account_id;
            return accountId === params.accountId;
          })
          .map((row) => String(row.contact_id)),
      );

      if (valid.size !== dedupContactIds.length) {
        throw new Error(
          'One or more selected contacts are not in this business',
        );
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
