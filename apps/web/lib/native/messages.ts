/* eslint-disable @typescript-eslint/no-explicit-any -- admin query builder is untyped */
import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  getTeamAccountAccess,
  isInternalTeamMessageRole,
} from '~/home/[account]/_lib/role-access';
import { loadMessageClientOptions } from '~/home/[account]/messages/_lib/server/messages-client-directory';
import { loadMessageContactOptions } from '~/home/[account]/messages/_lib/server/messages-participants';
import {
  type ChatMessageItem,
  type MessageThreadListItem,
  createMessagesService,
} from '~/home/[account]/messages/_lib/server/messages.service';

import { uploadChatImage } from '~/lib/messages/upload-chat-image';

import { NativeHttpError } from './http';
import {
  NativeComposeTypeSchema,
  NativeCreateThreadBodySchema,
  NativeIsoDateTimeSchema,
  NativeSendMessageBodySchema,
  type NativeComposeThreadType,
  isAllowedChatImageUrl,
  matchesComposeQuery,
  nativeThreadTitle,
} from './messages-shared';
import type { NativeWorkspace } from './workspace-shared';

export {
  NativeComposeTypeSchema,
  NativeCreateThreadBodySchema,
  NativeIsoDateTimeSchema,
  NativeSendMessageBodySchema,
};

export type NativeMessageParticipant = {
  kind: 'member' | 'client' | 'contact';
  user_id: string | null;
  client_id: string | null;
  contact_id: string | null;
  display_name: string;
  email: string | null;
};

export type NativeMessageThread = {
  id: string;
  account_id: string;
  type: string;
  title: string;
  job_id: string | null;
  client_id: string | null;
  is_client_wide: boolean;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  unread_count: number;
  last_message_preview: string | null;
  participants: NativeMessageParticipant[];
};

export type NativeChatMessage = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
  sender_label: string;
  sender_avatar_url: string | null;
  attachments: Array<{
    type: string;
    id: string;
    title: string;
    href: string | null;
  }>;
  is_mine: boolean;
};

export type NativeComposeOption = {
  kind: 'person' | 'contact' | 'client' | 'job';
  id: string;
  name: string;
  subtitle: string | null;
  email: string | null;
};

function mapMessagesError(error: unknown): never {
  if (error instanceof NativeHttpError) {
    throw error;
  }

  const message = error instanceof Error ? error.message : 'Request failed';
  const lower = message.toLowerCase();
  if (
    lower.includes('not a participant') ||
    lower.includes('do not have access') ||
    lower.includes('not found')
  ) {
    throw new NativeHttpError(lower.includes('not found') ? 404 : 403, message);
  }

  throw new NativeHttpError(400, message);
}

async function loadUserDisplayNames(userIds: string[]) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const names = new Map<string, string>();
  if (unique.length === 0) return names;

  const admin = getSupabaseServerAdminClient();
  const [settingsRes, accountsRes, usersRes] = await Promise.all([
    admin
      .from('user_settings')
      .select('user_id, first_name, last_name')
      .in('user_id', unique),
    admin
      .from('accounts')
      .select('primary_owner_user_id, name')
      .eq('is_personal_account', true)
      .in('primary_owner_user_id', unique),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const settings = new Map<
    string,
    { first_name: string | null; last_name: string | null }
  >();
  for (const row of (settingsRes.data ?? []) as Array<{
    user_id: string;
    first_name: string | null;
    last_name: string | null;
  }>) {
    settings.set(row.user_id, row);
  }

  const personalName = new Map<string, string>();
  for (const row of (accountsRes.data ?? []) as Array<{
    primary_owner_user_id: string;
    name: string | null;
  }>) {
    if (row.name?.trim()) {
      personalName.set(row.primary_owner_user_id, row.name.trim());
    }
  }

  const users = new Map(
    (usersRes.data?.users ?? []).map((user) => [user.id, user]),
  );

  for (const id of unique) {
    const setting = settings.get(id);
    const fromSettings = [setting?.first_name, setting?.last_name]
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(' ');
    const user = users.get(id);
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const fromMeta =
      [meta.first_name, meta.last_name]
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .join(' ') ||
      (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
      (typeof meta.name === 'string' && meta.name.trim()) ||
      '';
    const email = user?.email?.trim() ?? '';
    names.set(
      id,
      fromSettings ||
        personalName.get(id) ||
        fromMeta ||
        email.split('@')[0] ||
        email ||
        'Someone',
    );
  }

  return names;
}

function mapThread(
  thread: MessageThreadListItem,
  currentUserId: string,
  names: Map<string, string>,
): NativeMessageThread {
  const participants = thread.participants.map((participant) => {
    const displayName =
      (participant.user_id && names.get(participant.user_id)) ||
      participant.display_name;
    return {
      kind: participant.kind,
      user_id: participant.user_id,
      client_id: participant.client_id,
      contact_id: participant.contact_id,
      display_name: displayName,
      email: null,
    };
  });

  return {
    id: thread.id,
    account_id: thread.account_id,
    type: thread.type,
    title: nativeThreadTitle({
      title: thread.title,
      type: thread.type,
      currentUserId,
      participants,
    }),
    job_id: thread.job_id,
    client_id: thread.client_id,
    is_client_wide: thread.is_client_wide,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
    last_message_at: thread.last_message_at,
    unread_count: thread.unread_count,
    last_message_preview: thread.last_message_preview,
    participants,
  };
}

function mapMessage(
  message: ChatMessageItem,
  currentUserId: string,
): NativeChatMessage {
  return {
    id: message.id,
    thread_id: message.thread_id,
    sender_user_id: message.sender_user_id,
    body: message.body,
    image_url: message.image_url,
    created_at: message.created_at,
    sender_label: message.sender_label,
    sender_avatar_url: message.sender_avatar_url,
    attachments: (message.attachments ?? []).map((attachment) => ({
      type: attachment.type,
      id: attachment.id,
      title: attachment.title,
      href: attachment.href,
    })),
    is_mine: message.sender_user_id === currentUserId,
  };
}

async function loadMembershipRole(accountId: string, userId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data } = await admin
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  return (data?.account_role as string | null | undefined) ?? null;
}

export async function listNativeMessageThreads(params: {
  userId: string;
  workspace: NativeWorkspace;
  limit?: number;
  clientId?: string;
}) {
  try {
    const service = createMessagesService();
    const threads = await service.listThreads({
      accountId: params.workspace.id,
      userId: params.userId,
      limit: params.limit ?? 50,
      clientId: params.clientId,
    });
    const names = await loadUserDisplayNames(
      threads.flatMap((thread) =>
        thread.participants.map((participant) => participant.user_id ?? ''),
      ),
    );
    return threads.map((thread) => mapThread(thread, params.userId, names));
  } catch (error) {
    mapMessagesError(error);
  }
}

export async function getNativeMessageThread(
  userId: string,
  workspace: NativeWorkspace,
  threadId: string,
) {
  try {
    const service = createMessagesService();
    const thread = await service.getThread({
      accountId: workspace.id,
      userId,
      threadId,
    });
    const names = await loadUserDisplayNames(
      thread.participants.map((participant) => participant.user_id ?? ''),
    );
    return mapThread(thread, userId, names);
  } catch (error) {
    mapMessagesError(error);
  }
}

export async function listNativeThreadMessages(params: {
  userId: string;
  workspace: NativeWorkspace;
  threadId: string;
  before?: string;
  limit?: number;
}) {
  try {
    const service = createMessagesService();
    const messages = await service.listMessages({
      accountId: params.workspace.id,
      userId: params.userId,
      threadId: params.threadId,
      accountSlug: params.workspace.slug || params.workspace.id,
      before: params.before,
      limit: params.limit,
    });
    return messages.map((message) => mapMessage(message, params.userId));
  } catch (error) {
    mapMessagesError(error);
  }
}

export async function createNativeMessageThread(params: {
  userId: string;
  workspace: NativeWorkspace;
  type?: NativeComposeThreadType;
  title?: string;
  jobId?: string | null;
  clientId?: string | null;
  memberUserIds?: string[];
  contactIds?: string[];
  clientIds?: string[];
}) {
  try {
    const service = createMessagesService();
    return await service.createThread({
      accountId: params.workspace.id,
      userId: params.userId,
      type: params.type ?? 'direct',
      title: params.title,
      jobId: params.jobId,
      clientId: params.clientId,
      memberUserIds: params.memberUserIds,
      contactIds: params.contactIds,
      clientIds: params.clientIds,
    });
  } catch (error) {
    mapMessagesError(error);
  }
}

export async function sendNativeThreadMessage(params: {
  userId: string;
  workspace: NativeWorkspace;
  threadId: string;
  body?: string;
  imageUrl?: string;
  attachments?: Array<{ type: 'note' | 'doc'; id: string; title: string }>;
}) {
  try {
    if (params.imageUrl && !isAllowedChatImageUrl(params.imageUrl)) {
      throw new NativeHttpError(400, 'Image URL is not valid');
    }
    const service = createMessagesService();
    const message = await service.sendMessage({
      accountId: params.workspace.id,
      userId: params.userId,
      threadId: params.threadId,
      accountSlug: params.workspace.slug || params.workspace.id,
      body: params.body ?? '',
      imageUrl: params.imageUrl,
      attachments: params.attachments,
    });
    return mapMessage(message, params.userId);
  } catch (error) {
    mapMessagesError(error);
  }
}

export async function markNativeThreadRead(params: {
  userId: string;
  workspace: NativeWorkspace;
  threadId: string;
}) {
  try {
    const service = createMessagesService();
    return await service.markThreadRead({
      accountId: params.workspace.id,
      userId: params.userId,
      threadId: params.threadId,
    });
  } catch (error) {
    mapMessagesError(error);
  }
}

export async function listNativeMessageCompose(params: {
  userId: string;
  workspace: NativeWorkspace;
  query?: string;
}) {
  const admin = getSupabaseServerAdminClient() as any;
  const role = await loadMembershipRole(params.workspace.id, params.userId);
  const access = getTeamAccountAccess({ role });
  const query = params.query ?? '';

  const [membersRes, jobsRes] = await Promise.all([
    admin
      .from('accounts_memberships')
      .select('user_id, account_role')
      .eq('account_id', params.workspace.id),
    admin
      .from('jobs')
      .select('id, title')
      .eq('account_id', params.workspace.id)
      .order('updated_at', { ascending: false })
      .limit(300),
  ]);

  const memberships = (membersRes.data ?? []) as Array<{
    user_id: string;
    account_role: string | null;
  }>;
  const memberIds = memberships
    .filter((membership) => membership.user_id !== params.userId)
    .filter((membership) =>
      access.canMessageClients
        ? true
        : isInternalTeamMessageRole(membership.account_role),
    )
    .map((membership) => membership.user_id);

  const names = await loadUserDisplayNames(memberIds);
  const users: Array<{ id: string; email?: string | null }> = memberIds.length
    ? ((
        (await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        })) as {
          data?: { users?: Array<{ id: string; email?: string | null }> };
        }
      ).data?.users ?? [])
    : [];
  const emailById = new Map<string, string>(
    users.map((user) => [user.id, user.email ?? '']),
  );

  const people: NativeComposeOption[] = memberIds
    .map((id) => ({
      kind: 'person' as const,
      id,
      name: names.get(id) ?? emailById.get(id) ?? 'Teammate',
      subtitle: emailById.get(id) || 'Teammate',
      email: emailById.get(id) || null,
    }))
    .filter((option) =>
      matchesComposeQuery(query, option.name, option.subtitle, option.email),
    );

  type ClientOption = Awaited<
    ReturnType<typeof loadMessageClientOptions>
  >[number];
  type ContactOption = Awaited<
    ReturnType<typeof loadMessageContactOptions>
  >[number];
  const [clients, contacts] = access.canMessageClients
    ? await Promise.all([
        loadMessageClientOptions(admin, params.workspace.id) as Promise<
          ClientOption[]
        >,
        loadMessageContactOptions(admin, params.workspace.id) as Promise<
          ContactOption[]
        >,
      ])
    : [[] as ClientOption[], [] as ContactOption[]];

  const clientOptions: NativeComposeOption[] = clients
    .map((client) => ({
      kind: 'client' as const,
      id: client.clientId,
      name: client.name,
      subtitle: client.email ?? 'Client',
      email: client.email,
    }))
    .filter((option) =>
      matchesComposeQuery(query, option.name, option.subtitle, option.email),
    );

  const contactOptions: NativeComposeOption[] = contacts
    .map((contact) => ({
      kind: 'contact' as const,
      id: contact.contactId,
      name: contact.name,
      subtitle: contact.clientName,
      email: contact.email,
    }))
    .filter((option) =>
      matchesComposeQuery(
        query,
        option.name,
        option.subtitle,
        option.email,
        contacts.find((contact) => contact.contactId === option.id)?.clientName,
      ),
    );

  const jobOptions: NativeComposeOption[] = (
    (jobsRes.data ?? []) as Array<{ id: string; title: string | null }>
  )
    .map((job) => ({
      kind: 'job' as const,
      id: job.id,
      name: job.title?.trim() || 'Untitled project',
      subtitle: 'Project',
      email: null,
    }))
    .filter((option) =>
      matchesComposeQuery(query, option.name, option.subtitle),
    );

  return {
    can_message_clients: access.canMessageClients,
    items: [
      ...people,
      ...contactOptions,
      ...clientOptions,
      ...jobOptions,
    ].slice(0, 40),
  };
}

export async function uploadNativeChatImage(params: {
  userId: string;
  workspace: NativeWorkspace;
  threadId: string;
  file: File;
}) {
  try {
    const uploaded = await uploadChatImage({
      userId: params.userId,
      threadId: params.threadId,
      file: params.file,
      accountId: params.workspace.id,
    });
    return { image_url: uploaded.imageUrl };
  } catch (error) {
    mapMessagesError(error);
  }
}

export async function listNativeAttachableItems(params: {
  userId: string;
  workspace: NativeWorkspace;
  threadId: string;
}) {
  try {
    const items = await createMessagesService().listAttachableItems({
      accountId: params.workspace.id,
      userId: params.userId,
      threadId: params.threadId,
    });
    return { items };
  } catch (error) {
    mapMessagesError(error);
  }
}
