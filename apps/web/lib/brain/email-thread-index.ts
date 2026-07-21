import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { buildThreadText } from '~/lib/email-assistant/thread-text';

import type { IndexableRecord } from './indexer';

type AdminClient = SupabaseClient;

export type EmailThreadForBrain = {
  id: string;
  account_id: string | null;
  subject: string | null;
  snippet: string | null;
  participants: unknown;
  assistant_category: 'needs_reply' | 'no_reply' | null;
  assistant_category_reason: string | null;
  client_id: string | null;
  project_id: string | null;
  last_message_at: string | null;
  updated_at: string;
};

type EmailMessageForBrain = {
  from_address: string | null;
  subject: string | null;
  body_text: string | null;
  snippet: string | null;
  internal_date: string | null;
};

type EmailActionItemForBrain = {
  title: string;
  detail: string | null;
  status: string;
};

const MAX_MESSAGES_PER_THREAD = 20;

/** Threads indexed into second brain: workspace-linked or flagged needs reply. */
export function shouldIndexEmailThreadForBrain(thread: {
  account_id?: string | null;
  assistant_category?: string | null;
  client_id?: string | null;
  project_id?: string | null;
}): boolean {
  if (!thread.account_id) {
    return false;
  }

  if (thread.assistant_category === 'needs_reply') {
    return true;
  }

  if (thread.client_id || thread.project_id) {
    return true;
  }

  return false;
}

function formatParticipants(participants: unknown): string | null {
  if (!Array.isArray(participants)) {
    return null;
  }

  const labels = participants
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const row = entry as { name?: string | null; email?: string | null };
      const email = row.email?.trim();
      const name = row.name?.trim();

      if (name && email) {
        return `${name} <${email}>`;
      }

      return email || name || null;
    })
    .filter((value): value is string => Boolean(value));

  return labels.length > 0 ? labels.join(', ') : null;
}

export function buildEmailThreadIndexText(params: {
  thread: EmailThreadForBrain;
  messages: EmailMessageForBrain[];
  clientName?: string | null;
  projectName?: string | null;
  actionItems?: EmailActionItemForBrain[];
}) {
  const title = params.thread.subject?.trim() || '(no subject)';
  const lines = [`# ${title}`];

  if (params.thread.assistant_category === 'needs_reply') {
    lines.push('Status: Needs reply');
    if (params.thread.assistant_category_reason?.trim()) {
      lines.push(`Reason: ${params.thread.assistant_category_reason.trim()}`);
    }
  } else if (params.thread.assistant_category === 'no_reply') {
    lines.push('Status: No reply needed');
  }

  const participants = formatParticipants(params.thread.participants);
  if (participants) {
    lines.push(`Participants: ${participants}`);
  }

  if (params.clientName) {
    lines.push(`Linked client: ${params.clientName}`);
  }

  if (params.projectName) {
    lines.push(`Linked project: ${params.projectName}`);
  }

  if (params.thread.last_message_at) {
    lines.push(
      `Last message: ${new Date(params.thread.last_message_at).toISOString()}`,
    );
  }

  if (params.actionItems?.length) {
    lines.push('', '## Suggested action items');
    for (const item of params.actionItems) {
      lines.push(`- ${item.title}${item.status !== 'suggested' ? ` (${item.status})` : ''}`);
      if (item.detail?.trim()) {
        lines.push(`  ${item.detail.trim()}`);
      }
    }
  }

  const messageText = buildThreadText(
    params.messages.slice(-MAX_MESSAGES_PER_THREAD),
  );

  if (messageText.trim()) {
    lines.push('', '## Messages', '', messageText);
  } else if (params.thread.snippet?.trim()) {
    lines.push('', '## Preview', '', params.thread.snippet.trim());
  }

  return lines.join('\n');
}

function emailThreadUpdatedAt(
  thread: EmailThreadForBrain,
  messages: EmailMessageForBrain[],
): string {
  const candidates = [thread.updated_at, thread.last_message_at ?? ''];

  for (const message of messages) {
    if (message.internal_date) {
      candidates.push(message.internal_date);
    }
  }

  return candidates.reduce((latest, value) =>
    value && value > latest ? value : latest,
  thread.updated_at);
}

async function loadLinkedNames(
  admin: AdminClient,
  thread: EmailThreadForBrain,
): Promise<{ clientName: string | null; projectName: string | null }> {
  let clientName: string | null = null;
  let projectName: string | null = null;

  if (thread.client_id) {
    const { data } = await admin
      .from('clients')
      .select('display_name, company_name, first_name, last_name')
      .eq('id', thread.client_id)
      .maybeSingle();

    if (data) {
      clientName =
        (data.display_name as string | null)?.trim() ||
        (data.company_name as string | null)?.trim() ||
        [(data.first_name as string | null), data.last_name as string | null]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        null;
    }
  }

  if (thread.project_id) {
    const { data } = await admin
      .from('projects')
      .select('name')
      .eq('id', thread.project_id)
      .maybeSingle();

    projectName = (data?.name as string | null)?.trim() || null;
  }

  return { clientName, projectName };
}

async function loadThreadBundle(
  admin: AdminClient,
  threadId: string,
  accountId: string,
): Promise<{
  thread: EmailThreadForBrain;
  messages: EmailMessageForBrain[];
  actionItems: EmailActionItemForBrain[];
} | null> {
  const { data: thread, error: threadError } = await admin
    .from('email_threads')
    .select(
      'id, account_id, subject, snippet, participants, assistant_category, assistant_category_reason, client_id, project_id, last_message_at, updated_at',
    )
    .eq('id', threadId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (threadError) {
    throw new Error(threadError.message);
  }

  if (!thread) {
    return null;
  }

  const row = thread as EmailThreadForBrain;

  if (!shouldIndexEmailThreadForBrain(row)) {
    return null;
  }

  const [{ data: messages, error: messagesError }, { data: actionItems }] =
    await Promise.all([
      admin
        .from('email_messages')
        .select(
          'from_address, subject, body_text, snippet, internal_date, created_at',
        )
        .eq('thread_id', threadId)
        .order('internal_date', { ascending: false, nullsFirst: false })
        .limit(MAX_MESSAGES_PER_THREAD),
      admin
        .from('email_action_items')
        .select('title, detail, status')
        .eq('thread_id', threadId)
        .in('status', ['suggested', 'accepted'])
        .order('created_at', { ascending: true }),
    ]);

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  return {
    thread: row,
    messages: ((messages ?? []) as EmailMessageForBrain[]).reverse(),
    actionItems: (actionItems ?? []) as EmailActionItemForBrain[],
  };
}

export async function mapEmailThreadToIndexable(
  admin: AdminClient,
  accountId: string,
  accountSlug: string,
  threadId: string,
): Promise<IndexableRecord | null> {
  const bundle = await loadThreadBundle(admin, threadId, accountId);

  if (!bundle) {
    return null;
  }

  const { clientName, projectName } = await loadLinkedNames(
    admin,
    bundle.thread,
  );
  const text = buildEmailThreadIndexText({
    thread: bundle.thread,
    messages: bundle.messages,
    clientName,
    projectName,
    actionItems: bundle.actionItems,
  }).trim();

  if (!text) {
    return null;
  }

  const title = bundle.thread.subject?.trim() || 'Email thread';

  return {
    sourceType: 'email_thread',
    sourceId: bundle.thread.id,
    accountId,
    accountSlug,
    title,
    text,
    updatedAt: emailThreadUpdatedAt(bundle.thread, bundle.messages),
    jobId: bundle.thread.project_id,
    clientId: bundle.thread.client_id,
  };
}

export async function loadEmailThreadIndexables(
  admin: AdminClient,
  accountId: string,
  accountSlug: string,
): Promise<IndexableRecord[]> {
  const { data: threads, error } = await admin
    .from('email_threads')
    .select(
      'id, account_id, subject, snippet, participants, assistant_category, assistant_category_reason, client_id, project_id, last_message_at, updated_at',
    )
    .eq('account_id', accountId)
    .or(
      'assistant_category.eq.needs_reply,client_id.not.is.null,project_id.not.is.null',
    );

  if (error) {
    throw new Error(`email_threads: ${error.message}`);
  }

  const records: IndexableRecord[] = [];

  for (const row of threads ?? []) {
    const mapped = await mapEmailThreadToIndexable(
      admin,
      accountId,
      accountSlug,
      row.id as string,
    );

    if (mapped) {
      records.push(mapped);
    }
  }

  return records;
}
