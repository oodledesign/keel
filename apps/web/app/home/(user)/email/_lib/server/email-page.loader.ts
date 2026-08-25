import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadPersonalSidebarWorkspaces } from '~/home/(user)/_lib/server/personal-sidebar-workspaces.loader';
import type { MailboxKind } from '~/lib/email-assistant/mailbox-kind';
import { mapEmailThreadRow } from '~/lib/email-assistant/map-email-thread-row';
import {
  EMAIL_THREAD_LINK_SELECT,
  enrichEmailThreadLinks,
} from '~/lib/email-assistant/thread-link-display';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import type { EmailPageInitialData, EmailThreadSummary } from '../types';

const THREAD_SELECT = `id, gmail_thread_id, subject, snippet, participants, is_unread, last_message_at, assistant_category, assistant_category_reason, assistant_category_confidence, follow_up_at, follow_up_note, link_confidence, link_suggestion, pipeline_lead_suggestion, pipeline_lead_confidence, pipeline_deal_id, ${EMAIL_THREAD_LINK_SELECT}`;

function inferSignatureIsHtml(
  signature: string | null | undefined,
  stored: boolean | null | undefined,
): boolean {
  if (stored === true) {
    return true;
  }

  if (stored === false) {
    return false;
  }

  const trimmed = signature?.trim();
  return Boolean(trimmed && /<[a-z][\s\S]*>/i.test(trimmed));
}

export type LoadEmailPageOptions = {
  mailboxKind?: MailboxKind;
  preferredAccountId?: string | null;
  accountSlug?: string | null;
};

export const loadEmailPageData = cache(
  async (options?: LoadEmailPageOptions): Promise<EmailPageInitialData> => {
    const mailboxKind = options?.mailboxKind ?? 'personal';
    const client = getSupabaseServerClient();
    const user = await requireUserInServerComponent();

    const [connectionResult, workspaces] = await Promise.all([
      client
        .from('google_connections')
        .select('id, google_email, connected_at')
        .eq('user_id', user.id)
        .eq('mailbox_kind', mailboxKind)
        .maybeSingle(),
      loadPersonalSidebarWorkspaces(),
    ]);

    const connection = connectionResult.data as {
      id?: string;
      google_email?: string;
      connected_at?: string;
    } | null;

    const connectionId = connection?.id ?? null;

    const [settingsResult, threadsResult] = await Promise.all([
      connectionId
        ? client
            .from('email_assistant_settings')
            .select(
              'style_notes, signature, signature_is_html, last_synced_at, auto_triage_enabled, auto_draft_enabled, auto_save_gmail_drafts, allow_send_from_ozer, ignored_senders, ignored_domains, ignored_subject_keywords, priority_senders, priority_domains, priority_subject_keywords',
            )
            .eq('connection_id', connectionId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      connectionId
        ? client
            .from('email_threads')
            .select(THREAD_SELECT)
            .eq('user_id', user.id)
            .eq('connection_id', connectionId)
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .limit(26)
        : Promise.resolve({ data: [] }),
    ]);

    const settingsRow = settingsResult.data as {
      style_notes?: string | null;
      signature?: string | null;
      signature_is_html?: boolean | null;
      last_synced_at?: string | null;
      auto_triage_enabled?: boolean | null;
      auto_draft_enabled?: boolean | null;
      auto_save_gmail_drafts?: boolean | null;
      allow_send_from_ozer?: boolean | null;
      ignored_senders?: string[] | null;
      ignored_domains?: string[] | null;
      ignored_subject_keywords?: string[] | null;
      priority_senders?: string[] | null;
      priority_domains?: string[] | null;
      priority_subject_keywords?: string[] | null;
    } | null;

    const threadRows = threadsResult.data ?? [];
    const hasMoreInitial = threadRows.length > 25;
    const pageRows = hasMoreInitial ? threadRows.slice(0, 25) : threadRows;

    return {
      mailboxKind,
      preferredAccountId: options?.preferredAccountId ?? null,
      accountSlug: options?.accountSlug ?? null,
      connection: connection?.google_email
        ? {
            googleEmail: connection.google_email,
            connectedAt: connection.connected_at ?? new Date().toISOString(),
          }
        : null,
      settings: {
        styleNotes: settingsRow?.style_notes ?? '',
        signature: settingsRow?.signature ?? '',
        signatureIsHtml: inferSignatureIsHtml(
          settingsRow?.signature,
          settingsRow?.signature_is_html,
        ),
        lastSyncedAt: settingsRow?.last_synced_at ?? null,
        autoTriageEnabled: settingsRow?.auto_triage_enabled ?? true,
        autoDraftEnabled: settingsRow?.auto_draft_enabled ?? true,
        autoSaveGmailDrafts: settingsRow?.auto_save_gmail_drafts ?? false,
        allowSendFromOzer: settingsRow?.allow_send_from_ozer ?? false,
        ignoredSenders: (settingsRow?.ignored_senders ?? []).filter(Boolean),
        ignoredDomains: (settingsRow?.ignored_domains ?? []).filter(Boolean),
        ignoredSubjectKeywords: (
          settingsRow?.ignored_subject_keywords ?? []
        ).filter(Boolean),
        prioritySenders: (settingsRow?.priority_senders ?? []).filter(Boolean),
        priorityDomains: (settingsRow?.priority_domains ?? []).filter(Boolean),
        prioritySubjectKeywords: (
          settingsRow?.priority_subject_keywords ?? []
        ).filter(Boolean),
      },
      threads: await enrichEmailThreadLinks(
        client,
        pageRows.map((row) =>
          mapEmailThreadRow(row as Record<string, unknown>),
        ),
      ),
      hasMoreThreads: hasMoreInitial,
      workspaces: workspaces.map((workspace) => ({
        id: workspace.id,
        slug: workspace.slug,
        label: workspace.label,
      })),
    };
  },
);

export async function loadEmailThreadDetailFromDb(
  threadId: string,
  userId?: string,
): Promise<EmailThreadSummary | null> {
  const client = getSupabaseServerClient();
  const user =
    userId != null
      ? { id: userId }
      : await requireUserInServerComponent();

  const { data, error } = await client
    .from('email_threads')
    .select(THREAD_SELECT)
    .eq('id', threadId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const thread = mapEmailThreadRow(data as Record<string, unknown>);
  const [enriched] = await enrichEmailThreadLinks(client, [thread]);
  return enriched ?? null;
}
