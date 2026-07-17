import 'server-only';

import pathsConfig from '~/config/paths.config';

export type MessageAttachmentInput = {
  type: 'note' | 'doc';
  id: string;
  title: string;
};

export type MessageAttachmentItem = MessageAttachmentInput & {
  href: string | null;
  isPublic: boolean;
};

type ThreadContext = {
  clientIds: string[];
  jobId: string | null;
  jobClientId: string | null;
};

async function loadThreadContext(
  admin: any,
  threadId: string,
): Promise<ThreadContext> {
  const { data: participants } = await admin
    .from('chat_thread_participants')
    .select('participant_kind, participant_client_id')
    .eq('thread_id', threadId);

  const clientIds = Array.from(
    new Set(
      (participants ?? [])
        .filter(
          (row: {
            participant_kind: string;
            participant_client_id: string | null;
          }) => row.participant_kind === 'client' && row.participant_client_id,
        )
        .map(
          (row: { participant_client_id: string | null }) =>
            row.participant_client_id as string,
        ),
    ),
  );

  const { data: thread } = await admin
    .from('chat_threads')
    .select('job_id')
    .eq('id', threadId)
    .maybeSingle();

  const jobId = (thread?.job_id as string | null) ?? null;
  let jobClientId: string | null = null;

  if (jobId) {
    const { data: job } = await admin
      .from('jobs')
      .select('client_id')
      .eq('id', jobId)
      .maybeSingle();
    jobClientId = (job?.client_id as string | null) ?? null;
  }

  return { clientIds, jobId, jobClientId };
}

function itemVisibleToClients(
  row: {
    is_public: boolean;
    client_id: string | null;
    client_org_id: string | null;
    job_id: string | null;
  },
  context: ThreadContext,
) {
  if (context.clientIds.length === 0) return true;

  if (row.is_public) return true;

  const linkedClientIds = [row.client_id, row.client_org_id].filter(
    Boolean,
  ) as string[];
  if (linkedClientIds.some((id) => context.clientIds.includes(id))) {
    return true;
  }

  if (
    context.jobId &&
    row.job_id === context.jobId &&
    context.jobClientId &&
    context.clientIds.includes(context.jobClientId)
  ) {
    return true;
  }

  return false;
}

function buildAttachmentHref(params: {
  type: 'note' | 'doc';
  id: string;
  accountSlug: string;
  isPublic: boolean;
  publicToken: string | null;
}) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';

  if (params.isPublic && params.publicToken) {
    return `${origin}/portal/shared/${encodeURIComponent(params.publicToken)}`;
  }

  if (params.type === 'note') {
    return pathsConfig.app.accountNoteDetail
      .replace('[account]', params.accountSlug)
      .replace('[noteId]', params.id);
  }

  return pathsConfig.app.accountDocDetail
    .replace('[account]', params.accountSlug)
    .replace('[docId]', params.id);
}

export async function validateMessageAttachments(params: {
  admin: any;
  accountId: string;
  threadId: string;
  attachments: MessageAttachmentInput[];
}) {
  if (params.attachments.length === 0) return;

  const context = await loadThreadContext(params.admin, params.threadId);

  for (const attachment of params.attachments) {
    const table = attachment.type === 'note' ? 'notes' : 'docs';
    const { data: row, error } = await params.admin
      .from(table)
      .select('id, title, is_public, client_id, client_org_id, job_id')
      .eq('id', attachment.id)
      .eq('account_id', params.accountId)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      throw new Error('Attached file or note was not found');
    }

    if (!itemVisibleToClients(row, context)) {
      throw new Error(
        `"${row.title?.trim() || attachment.title}" cannot be shared in this chat — enable public sharing or link it to a client on the thread.`,
      );
    }
  }
}

export async function listAttachableNotesAndDocs(params: {
  admin: any;
  accountId: string;
  threadId: string;
}) {
  const context = await loadThreadContext(params.admin, params.threadId);

  const [notesRes, docsRes] = await Promise.all([
    params.admin
      .from('notes')
      .select(
        'id, title, is_public, client_id, client_org_id, job_id, updated_at',
      )
      .eq('account_id', params.accountId)
      .order('updated_at', { ascending: false })
      .limit(200),
    params.admin
      .from('docs')
      .select(
        'id, title, kind, is_public, client_id, client_org_id, job_id, updated_at',
      )
      .eq('account_id', params.accountId)
      .order('updated_at', { ascending: false })
      .limit(200),
  ]);

  const items: Array<{
    id: string;
    type: 'note' | 'doc';
    title: string;
    isPublic: boolean;
    updatedAt: string;
  }> = [];

  for (const row of notesRes.data ?? []) {
    if (!itemVisibleToClients(row, context)) continue;
    items.push({
      id: row.id as string,
      type: 'note',
      title: (row.title as string)?.trim() || 'Untitled note',
      isPublic: Boolean(row.is_public),
      updatedAt: row.updated_at as string,
    });
  }

  for (const row of docsRes.data ?? []) {
    if (!itemVisibleToClients(row, context)) continue;
    items.push({
      id: row.id as string,
      type: 'doc',
      title: (row.title as string)?.trim() || 'Untitled file',
      isPublic: Boolean(row.is_public),
      updatedAt: row.updated_at as string,
    });
  }

  return items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function loadAttachmentsForMessages(params: {
  admin: any;
  accountSlug: string;
  messageIds: string[];
}) {
  const out = new Map<string, MessageAttachmentItem[]>();
  if (params.messageIds.length === 0) return out;

  const { data: rows, error } = await params.admin
    .from('chat_message_attachments')
    .select('message_id, attachment_type, attachment_id, title')
    .in('message_id', params.messageIds);

  if (error) throw error;

  const noteIds = (rows ?? [])
    .filter(
      (row: { attachment_type: string }) => row.attachment_type === 'note',
    )
    .map((row: { attachment_id: string }) => row.attachment_id);
  const docIds = (rows ?? [])
    .filter((row: { attachment_type: string }) => row.attachment_type === 'doc')
    .map((row: { attachment_id: string }) => row.attachment_id);

  const [notesRes, docsRes] = await Promise.all([
    noteIds.length
      ? params.admin
          .from('notes')
          .select('id, is_public, public_token')
          .in('id', noteIds)
      : Promise.resolve({ data: [] }),
    docIds.length
      ? params.admin
          .from('docs')
          .select('id, is_public, public_token')
          .in('id', docIds)
      : Promise.resolve({ data: [] }),
  ]);

  const noteMeta = new Map(
    (notesRes.data ?? []).map(
      (row: {
        id: string;
        is_public: boolean;
        public_token: string | null;
      }) => [row.id, row],
    ),
  );
  const docMeta = new Map(
    (docsRes.data ?? []).map(
      (row: {
        id: string;
        is_public: boolean;
        public_token: string | null;
      }) => [row.id, row],
    ),
  );

  for (const row of rows ?? []) {
    const messageId = row.message_id as string;
    const type = row.attachment_type as 'note' | 'doc';
    const attachmentId = row.attachment_id as string;
    const meta =
      type === 'note' ? noteMeta.get(attachmentId) : docMeta.get(attachmentId);
    const isPublic = Boolean(meta?.is_public);
    const publicToken = (meta?.public_token as string | null) ?? null;

    const list = out.get(messageId) ?? [];
    list.push({
      type,
      id: attachmentId,
      title: (row.title as string)?.trim() || 'Attachment',
      isPublic,
      href: meta
        ? buildAttachmentHref({
            type,
            id: attachmentId,
            accountSlug: params.accountSlug,
            isPublic,
            publicToken,
          })
        : null,
    });
    out.set(messageId, list);
  }

  return out;
}
