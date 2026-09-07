/* eslint-disable @typescript-eslint/no-explicit-any -- admin query builder is untyped */
import 'server-only';

import { after } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createMessagesAccessService } from './messages-access.service';
import {
  type MessageAttachmentInput,
  type MessageAttachmentItem,
  listAttachableNotesAndDocs,
  loadAttachmentsForMessages,
  validateMessageAttachments,
} from './messages-attachments.service';
import { loadClientDisplayByIds } from './messages-client-directory';
import { createMessagesNotificationsService } from './messages-notifications.service';
import {
  loadContactDisplayByIds,
  loadContactIdsForUser,
  loadPortalEnabledContactsForClient,
  resolveClientOrgForClient,
} from './messages-participants';

type ThreadType = 'direct' | 'group' | 'job' | 'client_portal';
type ComposeType = 'direct' | 'group' | 'job' | 'client';

export type MessageThreadListItem = {
  id: string;
  account_id: string;
  type: ThreadType;
  title: string | null;
  job_id: string | null;
  client_id: string | null;
  client_org_id: string | null;
  is_client_wide: boolean;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  unread_count: number;
  last_message_preview: string | null;
  participants: Array<{
    kind: 'member' | 'client' | 'contact';
    user_id: string | null;
    client_id: string | null;
    contact_id: string | null;
    display_name: string;
    email: string | null;
  }>;
};

export type ChatMessageItem = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
  /** Display name for bubbles (metadata, participant, or email). */
  sender_label: string;
  sender_avatar_url: string | null;
  attachments: MessageAttachmentItem[];
};

export function createMessagesService() {
  return new MessagesService();
}

class MessagesService {
  private readonly admin: any = getSupabaseServerAdminClient();
  private readonly access = createMessagesAccessService(this.admin);
  private readonly notifications = createMessagesNotificationsService(
    this.admin,
  );

  private async loadThreadParticipants(threadIds: string[]) {
    if (threadIds.length === 0)
      return new Map<string, MessageThreadListItem['participants']>();

    const { data: rows } = await this.admin
      .from('chat_thread_participants')
      .select(
        'thread_id, participant_kind, participant_user_id, participant_client_id, participant_contact_id',
      )
      .in('thread_id', threadIds);

    const userIds = Array.from(
      new Set(
        (rows ?? []).map((r: any) => r.participant_user_id).filter(Boolean),
      ),
    ) as string[];
    const clientIds = Array.from(
      new Set(
        (rows ?? []).map((r: any) => r.participant_client_id).filter(Boolean),
      ),
    ) as string[];
    const contactIds = Array.from(
      new Set(
        (rows ?? []).map((r: any) => r.participant_contact_id).filter(Boolean),
      ),
    ) as string[];

    const [usersRes, clientMap, contactMap] = await Promise.all([
      userIds.length
        ? this.admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        : Promise.resolve({ data: { users: [] } } as any),
      loadClientDisplayByIds(this.admin, clientIds),
      loadContactDisplayByIds(this.admin, contactIds),
    ]);

    const userMap = new Map<string, { email: string | null }>();
    for (const u of usersRes.data?.users ?? []) {
      userMap.set(u.id, { email: u.email ?? null });
    }

    const out = new Map<string, MessageThreadListItem['participants']>();
    for (const row of rows ?? []) {
      const list = out.get(row.thread_id) ?? [];
      if (row.participant_kind === 'member') {
        list.push({
          kind: 'member',
          user_id: row.participant_user_id,
          client_id: null,
          contact_id: null,
          display_name:
            userMap.get(row.participant_user_id)?.email ?? 'Team member',
          email: userMap.get(row.participant_user_id)?.email ?? null,
        });
      } else if (row.participant_kind === 'contact') {
        const contact = contactMap.get(row.participant_contact_id);
        list.push({
          kind: 'contact',
          user_id: row.participant_user_id ?? null,
          client_id: null,
          contact_id: row.participant_contact_id,
          display_name: contact?.name ?? 'Contact',
          email: contact?.email ?? null,
        });
      } else {
        const client = clientMap.get(row.participant_client_id);
        list.push({
          kind: 'client',
          user_id: null,
          client_id: row.participant_client_id,
          contact_id: null,
          display_name: client?.name ?? 'Client',
          email: client?.email ?? null,
        });
      }
      out.set(row.thread_id, list);
    }

    return out;
  }

  async listThreads(params: {
    accountId: string;
    userId: string;
    clientId?: string;
    limit?: number;
  }) {
    await this.access.assertAccountMember(params.accountId, params.userId);

    const limit = params.limit ?? 40;
    const contactIds = await loadContactIdsForUser(this.admin, params.userId);

    const [byUser, byContact] = await Promise.all([
      this.admin
        .from('chat_thread_participants')
        .select('thread_id, last_read_at')
        .eq('participant_user_id', params.userId)
        .is('archived_at', null)
        .limit(500),
      contactIds.length
        ? this.admin
            .from('chat_thread_participants')
            .select('thread_id, last_read_at')
            .in('participant_contact_id', contactIds)
            .is('archived_at', null)
            .limit(500)
        : Promise.resolve({
            data: [] as Array<{
              thread_id: string;
              last_read_at: string | null;
            }>,
          }),
    ]);

    const participantRows = [...(byUser.data ?? []), ...(byContact.data ?? [])];
    const threadIds = Array.from(
      new Set(participantRows.map((p: any) => p.thread_id)),
    );
    if (threadIds.length === 0) {
      return [] as MessageThreadListItem[];
    }

    let query = this.admin
      .from('chat_threads')
      .select(
        'id, account_id, type, title, job_id, client_id, client_org_id, is_client_wide, created_at, updated_at, last_message_at',
      )
      .eq('account_id', params.accountId)
      .in('id', threadIds)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (params.clientId) {
      query = query.eq('client_id', params.clientId);
    }

    const { data: threads } = await query;

    const participantsMap = await this.loadThreadParticipants(
      (threads ?? []).map((t: any) => t.id),
    );

    const readMap = new Map<string, string | null>();
    for (const row of participantRows ?? []) {
      readMap.set(row.thread_id, row.last_read_at ?? null);
    }

    const out: MessageThreadListItem[] = [];
    for (const thread of threads ?? []) {
      const { data: latestMessage } = await this.admin
        .from('chat_messages')
        .select('id, body, image_url, created_at')
        .eq('thread_id', thread.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let attachmentPreview: string | null = null;
      if (
        latestMessage?.id &&
        !latestMessage.body?.trim() &&
        !latestMessage.image_url
      ) {
        const { count } = await this.admin
          .from('chat_message_attachments')
          .select('id', { count: 'exact', head: true })
          .eq('message_id', latestMessage.id);
        if ((count ?? 0) > 0) {
          attachmentPreview =
            (count ?? 0) === 1 ? 'Attachment' : `${count} attachments`;
        }
      }

      const lastReadAt = readMap.get(thread.id);
      const unreadQuery = this.admin
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('thread_id', thread.id)
        .is('deleted_at', null)
        .neq('sender_user_id', params.userId);

      const unread =
        lastReadAt != null
          ? await unreadQuery.gt('created_at', lastReadAt)
          : await unreadQuery;

      out.push({
        ...thread,
        unread_count: unread.count ?? 0,
        last_message_preview:
          latestMessage?.body?.trim() ||
          (latestMessage?.image_url ? 'Image' : attachmentPreview),
        participants: participantsMap.get(thread.id) ?? [],
      });
    }

    return out;
  }

  private async enrichChatMessages(
    rows: Array<{
      id: string;
      thread_id: string;
      sender_user_id: string;
      body: string;
      image_url: string | null;
      created_at: string;
    }>,
    threadId: string,
    accountSlug: string,
  ): Promise<ChatMessageItem[]> {
    if (rows.length === 0) return [];

    const attachmentsByMessageId = await loadAttachmentsForMessages({
      admin: this.admin,
      accountSlug,
      messageIds: rows.map((row) => row.id),
    });

    const participantsMap = await this.loadThreadParticipants([threadId]);
    const participants = participantsMap.get(threadId) ?? [];
    const participantLabelByUserId = new Map<string, string>();
    for (const p of participants) {
      if (p.user_id) {
        participantLabelByUserId.set(p.user_id, p.display_name);
      }
    }

    const senderIds = Array.from(new Set(rows.map((r) => r.sender_user_id)));
    const usersRes =
      senderIds.length > 0
        ? await this.admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        : { data: { users: [] as any[] } };
    const userById = new Map<
      string,
      { email?: string | null; user_metadata?: Record<string, unknown> | null }
    >((usersRes.data?.users ?? []).map((u: any) => [u.id as string, u]));

    return rows.map((r) => {
      const u = userById.get(r.sender_user_id);
      const meta = (u?.user_metadata ?? {}) as Record<string, unknown>;
      const first = String(meta.first_name ?? '').trim();
      const last = String(meta.last_name ?? '').trim();
      const nameFromParts = [first, last].filter(Boolean).join(' ').trim();
      const fromMeta =
        (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
        (typeof meta.name === 'string' && meta.name.trim()) ||
        nameFromParts ||
        undefined;
      const avatarRaw =
        (meta.avatar_url as string | undefined) ||
        (meta.picture as string | undefined) ||
        (meta.picture_url as string | undefined);
      const label =
        fromMeta ||
        participantLabelByUserId.get(r.sender_user_id) ||
        u?.email ||
        'Someone';

      return {
        ...r,
        sender_label: label,
        sender_avatar_url:
          typeof avatarRaw === 'string' && avatarRaw.length > 0
            ? avatarRaw
            : null,
        attachments: attachmentsByMessageId.get(r.id) ?? [],
      };
    });
  }

  async listAttachableItems(params: {
    accountId: string;
    userId: string;
    threadId: string;
  }) {
    await this.access.assertAccountMember(params.accountId, params.userId);
    await this.access.assertThreadParticipant(params.threadId, params.userId);

    return listAttachableNotesAndDocs({
      admin: this.admin,
      accountId: params.accountId,
      threadId: params.threadId,
    });
  }

  async listMessages(params: {
    accountId: string;
    userId: string;
    threadId: string;
    accountSlug: string;
    limit?: number;
    before?: string;
  }) {
    await this.access.assertAccountMember(params.accountId, params.userId);
    await this.access.assertThreadParticipant(params.threadId, params.userId);

    let query = this.admin
      .from('chat_messages')
      .select('id, thread_id, sender_user_id, body, image_url, created_at')
      .eq('thread_id', params.threadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(params.limit ?? 50);

    if (params.before) {
      query = query.lt('created_at', params.before);
    }

    const { data } = await query;
    const ordered = (data ?? []).reverse();
    return this.enrichChatMessages(
      ordered,
      params.threadId,
      params.accountSlug,
    );
  }

  async createThread(params: {
    accountId: string;
    userId: string;
    type: ComposeType;
    title?: string;
    jobId?: string | null;
    clientId?: string | null;
    memberUserIds?: string[];
    clientIds?: string[];
    contactIds?: string[];
  }) {
    await this.access.validateThreadCreation({
      accountId: params.accountId,
      creatorUserId: params.userId,
      type: params.type,
      jobId: params.jobId ?? null,
      clientId: params.clientId ?? null,
      memberUserIds: params.memberUserIds ?? [],
      clientIds: params.clientIds ?? [],
      contactIds: params.contactIds ?? [],
    });

    if (params.type === 'client') {
      return this.createOrOpenWholeClientThread(params);
    }

    const memberUserIds = Array.from(
      new Set([params.userId, ...(params.memberUserIds ?? [])]),
    );
    const contactIds = Array.from(new Set(params.contactIds ?? []));
    const clientIds = Array.from(new Set(params.clientIds ?? []));

    const portalUserByContact = new Map<string, string | null>();
    if (contactIds.length > 0) {
      const { data: inviteRows } = await this.admin
        .from('client_portal_invites')
        .select('contact_id, user_id')
        .in('contact_id', contactIds)
        .eq('status', 'accepted');
      for (const row of inviteRows ?? []) {
        if (row.contact_id) {
          portalUserByContact.set(
            row.contact_id as string,
            (row.user_id as string | null) ?? null,
          );
        }
      }
    }
    const linkedClientId =
      params.clientId ??
      (await this.inferClientIdFromContacts(params.accountId, contactIds));
    const linkedOrg = linkedClientId
      ? await resolveClientOrgForClient(this.admin, linkedClientId)
      : null;

    const storedType: ThreadType =
      params.type === 'job'
        ? 'job'
        : params.type === 'direct'
          ? 'direct'
          : 'group';

    const { data: thread, error } = await this.admin
      .from('chat_threads')
      .insert({
        account_id: params.accountId,
        type: storedType,
        title: params.title?.trim() || null,
        job_id: params.jobId ?? null,
        client_id: linkedClientId,
        client_org_id: linkedOrg?.client_org_id ?? null,
        is_client_wide: false,
        created_by: params.userId,
      })
      .select('id')
      .single();

    if (error || !thread) {
      throw new Error(error?.message ?? 'Failed to create thread');
    }

    const participantRows = [
      ...memberUserIds.map((id) => ({
        thread_id: thread.id,
        participant_kind: 'member' as const,
        participant_user_id: id,
        participant_client_id: null,
        participant_contact_id: null,
      })),
      ...contactIds.map((id) => {
        const linkedUserId = portalUserByContact.get(id) ?? null;
        return {
          thread_id: thread.id,
          participant_kind: 'contact' as const,
          participant_user_id:
            linkedUserId && memberUserIds.includes(linkedUserId)
              ? null
              : linkedUserId,
          participant_client_id: null,
          participant_contact_id: id,
        };
      }),
      ...clientIds.map((id) => ({
        thread_id: thread.id,
        participant_kind: 'client' as const,
        participant_user_id: null,
        participant_client_id: id,
        participant_contact_id: null,
      })),
    ];

    if (participantRows.length > 0) {
      const { error: participantsError } = await this.admin
        .from('chat_thread_participants')
        .insert(participantRows);

      if (participantsError) {
        throw new Error(participantsError.message);
      }
    }

    return { threadId: thread.id };
  }

  private async inferClientIdFromContacts(
    accountId: string,
    contactIds: string[],
  ): Promise<string | null> {
    if (contactIds.length === 0) return null;
    const { data } = await this.admin
      .from('client_contacts')
      .select('client_id, clients!inner ( account_id )')
      .in('contact_id', contactIds);

    const clientIds = Array.from(
      new Set(
        ((data ?? []) as Array<Record<string, unknown>>)
          .filter((row) => {
            const related = row.clients as
              | { account_id?: string }
              | Array<{ account_id?: string }>
              | null;
            const relatedAccountId = Array.isArray(related)
              ? related[0]?.account_id
              : related?.account_id;
            return relatedAccountId === accountId;
          })
          .map((row) => String(row.client_id)),
      ),
    );
    return clientIds.length === 1 ? (clientIds[0] ?? null) : null;
  }

  private async createOrOpenWholeClientThread(params: {
    accountId: string;
    userId: string;
    title?: string;
    clientId?: string | null;
    memberUserIds?: string[];
  }) {
    const clientId = params.clientId;
    if (!clientId) throw new Error('Choose a client for a whole-client chat');

    const client = await resolveClientOrgForClient(this.admin, clientId);
    if (!client || client.account_id !== params.accountId) {
      throw new Error('Client not found in this business');
    }

    const { data: existingPortal } = client.client_org_id
      ? await this.admin
          .from('chat_threads')
          .select('id')
          .eq('account_id', params.accountId)
          .eq('client_org_id', client.client_org_id)
          .eq('type', 'client_portal')
          .maybeSingle()
      : { data: null };

    if (existingPortal?.id) {
      const threadId = existingPortal.id as string;
      await this.admin.rpc('seed_client_wide_thread_participants', {
        p_thread_id: threadId,
      });
      const extraMembers = Array.from(
        new Set([params.userId, ...(params.memberUserIds ?? [])]),
      );
      await this.admin.from('chat_thread_participants').upsert(
        extraMembers.map((id) => ({
          thread_id: threadId,
          participant_kind: 'member',
          participant_user_id: id,
          participant_client_id: null,
          participant_contact_id: null,
        })),
        { onConflict: 'thread_id,participant_user_id' },
      );
      return { threadId };
    }

    const portalContacts = await loadPortalEnabledContactsForClient(
      this.admin,
      clientId,
    );
    const memberUserIds = Array.from(
      new Set([params.userId, ...(params.memberUserIds ?? [])]),
    );

    const { data: existing } = await this.admin
      .from('chat_threads')
      .select('id')
      .eq('account_id', params.accountId)
      .eq('client_id', clientId)
      .eq('is_client_wide', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const threadId = existing.id as string;
      await this.admin.rpc('seed_client_wide_thread_participants', {
        p_thread_id: threadId,
      });
      await this.admin.from('chat_thread_participants').upsert(
        memberUserIds.map((id) => ({
          thread_id: threadId,
          participant_kind: 'member',
          participant_user_id: id,
          participant_client_id: null,
          participant_contact_id: null,
        })),
        { onConflict: 'thread_id,participant_user_id' },
      );
      return { threadId };
    }

    const { data: thread, error } = await this.admin
      .from('chat_threads')
      .insert({
        account_id: params.accountId,
        type: client.client_org_id ? 'client_portal' : 'group',
        title: params.title?.trim() || null,
        client_id: clientId,
        client_org_id: client.client_org_id,
        is_client_wide: true,
        created_by: params.userId,
      })
      .select('id')
      .single();

    if (error || !thread) {
      throw new Error(error?.message ?? 'Failed to create client chat');
    }

    const { error: participantsError } = await this.admin
      .from('chat_thread_participants')
      .insert([
        ...memberUserIds.map((id) => ({
          thread_id: thread.id,
          participant_kind: 'member' as const,
          participant_user_id: id,
          participant_client_id: null,
          participant_contact_id: null,
        })),
        ...portalContacts.map((contact) => ({
          thread_id: thread.id,
          participant_kind: 'contact' as const,
          participant_user_id:
            contact.userId && memberUserIds.includes(contact.userId)
              ? null
              : contact.userId,
          participant_client_id: null,
          participant_contact_id: contact.contactId,
        })),
      ]);

    if (participantsError) {
      throw new Error(participantsError.message);
    }

    return { threadId: thread.id };
  }

  async markThreadRead(params: {
    accountId: string;
    userId: string;
    threadId: string;
  }) {
    await this.access.assertThreadParticipant(params.threadId, params.userId);

    const readAt = new Date().toISOString();
    const contactIds = await loadContactIdsForUser(this.admin, params.userId);
    const { error } = await this.admin
      .from('chat_thread_participants')
      .update({ last_read_at: readAt })
      .eq('thread_id', params.threadId)
      .eq('participant_user_id', params.userId);

    if (error) throw error;

    if (contactIds.length > 0) {
      await this.admin
        .from('chat_thread_participants')
        .update({ last_read_at: readAt })
        .eq('thread_id', params.threadId)
        .in('participant_contact_id', contactIds);
    }

    const { data: messageRows } = await this.admin
      .from('chat_messages')
      .select('id')
      .eq('thread_id', params.threadId)
      .is('deleted_at', null)
      .lte('created_at', readAt)
      .limit(500);

    if ((messageRows ?? []).length > 0) {
      await this.admin.from('chat_message_reads').upsert(
        (messageRows ?? []).map((row: any) => ({
          message_id: row.id,
          user_id: params.userId,
          read_at: readAt,
        })),
        { onConflict: 'message_id,user_id' },
      );
    }

    return { ok: true };
  }

  async sendMessage(params: {
    accountId: string;
    userId: string;
    threadId: string;
    body: string;
    accountSlug: string;
    imageUrl?: string;
    attachments?: MessageAttachmentInput[];
  }) {
    await this.access.assertThreadParticipant(params.threadId, params.userId);
    await this.access.assertThreadClientsNotArchived(params.threadId);

    const text = params.body.trim();
    const hasImage = Boolean(params.imageUrl?.trim());
    const attachments = params.attachments ?? [];
    if (!text && !hasImage && attachments.length === 0) {
      throw new Error('Message cannot be empty');
    }

    await validateMessageAttachments({
      admin: this.admin,
      accountId: params.accountId,
      threadId: params.threadId,
      attachments,
    });

    const { data: message, error } = await this.admin
      .from('chat_messages')
      .insert({
        thread_id: params.threadId,
        sender_user_id: params.userId,
        body: text,
        image_url: hasImage ? params.imageUrl : null,
      })
      .select('id, thread_id, sender_user_id, body, image_url, created_at')
      .single();

    if (error || !message) {
      throw new Error(error?.message ?? 'Failed to send message');
    }

    if (attachments.length > 0) {
      const { error: attachmentError } = await this.admin
        .from('chat_message_attachments')
        .insert(
          attachments.map((attachment) => ({
            message_id: message.id,
            attachment_type: attachment.type,
            attachment_id: attachment.id,
            title: attachment.title.trim() || 'Attachment',
          })),
        );

      if (attachmentError) {
        throw new Error(attachmentError.message);
      }
    }

    await this.admin.from('chat_message_reads').insert({
      message_id: message.id,
      user_id: params.userId,
      read_at: new Date().toISOString(),
    });

    await this.markThreadRead({
      accountId: params.accountId,
      userId: params.userId,
      threadId: params.threadId,
    });

    const previewBody =
      message.body ||
      (hasImage
        ? 'Sent an image'
        : attachments.length === 1
          ? `Shared ${attachments[0]!.title}`
          : attachments.length > 1
            ? `Shared ${attachments.length} files`
            : 'New message');

    after(() =>
      this.notifications
        .notifyOnMessage({
          accountId: params.accountId,
          accountSlug: params.accountSlug,
          threadId: params.threadId,
          senderUserId: params.userId,
          messageBody: previewBody,
        })
        .catch((error) => {
          console.warn('[messages] notify after send failed', {
            threadId: params.threadId,
            error: error instanceof Error ? error.message : String(error),
          });
        }),
    );

    const enrichedList = await this.enrichChatMessages(
      [message],
      params.threadId,
      params.accountSlug,
    );
    return (
      enrichedList[0] ?? {
        ...message,
        image_url: null,
        sender_label: 'Someone',
        sender_avatar_url: null,
        attachments: [],
      }
    );
  }

  async archiveThread(params: {
    accountId: string;
    userId: string;
    threadId: string;
  }) {
    await this.access.assertAccountMember(params.accountId, params.userId);
    await this.access.assertThreadParticipant(params.threadId, params.userId);

    const { error } = await this.admin
      .from('chat_thread_participants')
      .update({ archived_at: new Date().toISOString() })
      .eq('thread_id', params.threadId)
      .eq('participant_user_id', params.userId);

    if (error) throw error;
    return { ok: true };
  }

  async deleteMessage(params: {
    accountId: string;
    userId: string;
    threadId: string;
    messageId: string;
  }) {
    await this.access.assertAccountMember(params.accountId, params.userId);
    await this.access.assertThreadParticipant(params.threadId, params.userId);

    const { data: existing } = await this.admin
      .from('chat_messages')
      .select('id, sender_user_id, thread_id, deleted_at')
      .eq('id', params.messageId)
      .eq('thread_id', params.threadId)
      .maybeSingle();

    if (!existing) throw new Error('Message not found');
    if (existing.sender_user_id !== params.userId) {
      throw new Error('You can only delete your own messages');
    }
    if (existing.deleted_at) return { ok: true };

    const { error } = await this.admin
      .from('chat_messages')
      .update({
        body: '',
        image_url: null,
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: params.userId,
      })
      .eq('id', params.messageId)
      .eq('thread_id', params.threadId);

    if (error) throw error;
    return { ok: true };
  }

  async renameThread(params: {
    accountId: string;
    userId: string;
    threadId: string;
    title: string;
  }) {
    await this.access.assertAccountMember(params.accountId, params.userId);
    await this.access.assertThreadParticipant(params.threadId, params.userId);

    const nextTitle = params.title.trim();
    if (!nextTitle) throw new Error('Chat title cannot be empty');

    const { error } = await this.admin
      .from('chat_threads')
      .update({ title: nextTitle })
      .eq('id', params.threadId)
      .eq('account_id', params.accountId);

    if (error) throw error;
    return { ok: true };
  }

  async setThreadJob(params: {
    accountId: string;
    userId: string;
    threadId: string;
    jobId: string | null;
  }) {
    await this.access.assertAccountMember(params.accountId, params.userId);
    await this.access.assertThreadParticipant(params.threadId, params.userId);

    if (params.jobId) {
      const { data: job, error: jobError } = await this.admin
        .from('jobs')
        .select('id, account_id')
        .eq('id', params.jobId)
        .maybeSingle();
      if (jobError || !job || job.account_id !== params.accountId) {
        throw new Error('Invalid job for this account');
      }
    }

    const updates: { job_id: string | null; type?: ThreadType } = {
      job_id: params.jobId,
    };
    if (params.jobId) {
      updates.type = 'job';
    }

    const { error } = await this.admin
      .from('chat_threads')
      .update(updates)
      .eq('id', params.threadId)
      .eq('account_id', params.accountId);

    if (error) throw error;
    return { ok: true };
  }

  scheduleNotify(params: {
    accountId: string;
    accountSlug: string;
    threadId: string;
    senderUserId: string;
    messageBody: string;
  }) {
    return this.notifications.notifyOnMessage(params);
  }

  async listPortalThreads(params: {
    userId: string;
    clientOrgId: string;
    limit?: number;
  }) {
    const contactIds = await loadContactIdsForUser(this.admin, params.userId);
    const [byUser, byContact] = await Promise.all([
      this.admin
        .from('chat_thread_participants')
        .select('thread_id, last_read_at')
        .eq('participant_user_id', params.userId)
        .is('archived_at', null)
        .limit(500),
      contactIds.length
        ? this.admin
            .from('chat_thread_participants')
            .select('thread_id, last_read_at')
            .in('participant_contact_id', contactIds)
            .is('archived_at', null)
            .limit(500)
        : Promise.resolve({ data: [] as Array<{ thread_id: string }> }),
    ]);

    const threadIds = Array.from(
      new Set(
        [...(byUser.data ?? []), ...(byContact.data ?? [])].map(
          (row: { thread_id: string }) => row.thread_id,
        ),
      ),
    );
    if (threadIds.length === 0) return [] as MessageThreadListItem[];

    const { data: clients } = await this.admin
      .from('clients')
      .select('id')
      .eq('client_org_id', params.clientOrgId);

    const clientIds = (clients ?? []).map((row: { id: string }) => row.id);

    const threadQuery = this.admin
      .from('chat_threads')
      .select(
        'id, account_id, type, title, job_id, client_id, client_org_id, is_client_wide, created_at, updated_at, last_message_at',
      )
      .in('id', threadIds)
      .order('last_message_at', { ascending: false })
      .limit(params.limit ?? 40);

    const { data: allMatched } = await threadQuery;
    const threads = (allMatched ?? []).filter((thread: any) => {
      return (
        thread.client_org_id === params.clientOrgId ||
        (thread.client_id && clientIds.includes(thread.client_id))
      );
    });

    const participantsMap = await this.loadThreadParticipants(
      (threads ?? []).map((t: { id: string }) => t.id),
    );

    const out: MessageThreadListItem[] = [];
    for (const thread of threads ?? []) {
      const { data: latestMessage } = await this.admin
        .from('chat_messages')
        .select('id, body, image_url, created_at')
        .eq('thread_id', thread.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      out.push({
        ...thread,
        unread_count: 0,
        last_message_preview:
          latestMessage?.body?.trim() ||
          (latestMessage?.image_url ? 'Image' : null),
        participants: participantsMap.get(thread.id) ?? [],
      });
    }

    return out;
  }

  async assertCanUploadImage(params: { userId: string; threadId: string }) {
    await this.access.assertThreadParticipant(params.threadId, params.userId);
  }

  async sendPortalMessage(params: {
    userId: string;
    threadId: string;
    body: string;
    imageUrl?: string;
    accountSlug: string;
  }) {
    await this.access.assertThreadParticipant(params.threadId, params.userId);

    const { data: thread } = await this.admin
      .from('chat_threads')
      .select('id, account_id')
      .eq('id', params.threadId)
      .maybeSingle();

    if (!thread) throw new Error('Thread not found');

    return this.sendMessage({
      accountId: thread.account_id,
      userId: params.userId,
      threadId: params.threadId,
      body: params.body,
      accountSlug: params.accountSlug,
      imageUrl: params.imageUrl,
    });
  }
}
