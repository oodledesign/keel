import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadPersonalSidebarWorkspaces } from '~/home/(user)/_lib/server/personal-sidebar-workspaces.loader';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import type {
  EmailPageInitialData,
  EmailParticipant,
  EmailThreadSummary,
} from '../types';
import {
  EMAIL_THREAD_LINK_SELECT,
  enrichEmailThreadLinks,
  mapThreadLinkFields,
} from '~/lib/email-assistant/thread-link-display';

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

function parseParticipants(value: unknown): EmailParticipant[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const row = entry as { name?: unknown; email?: unknown };
      const email = typeof row.email === 'string' ? row.email.trim() : '';

      if (!email) {
        return null;
      }

      return {
        name: typeof row.name === 'string' ? row.name : null,
        email,
      };
    })
    .filter((entry): entry is EmailParticipant => entry !== null);
}

function mapThreadRow(row: Record<string, unknown>): EmailThreadSummary {
  const category = row.assistant_category;
  const assistantCategory =
    category === 'needs_reply' || category === 'no_reply' ? category : null;

  return {
    id: String(row.id),
    gmail_thread_id: String(row.gmail_thread_id),
    subject: (row.subject as string | null) ?? null,
    snippet: (row.snippet as string | null) ?? null,
    participants: parseParticipants(row.participants),
    is_unread: Boolean(row.is_unread),
    last_message_at: (row.last_message_at as string | null) ?? null,
    assistant_category: assistantCategory,
    link: mapThreadLinkFields(row),
  };
}

export const loadEmailPageData = cache(async (): Promise<EmailPageInitialData> => {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const [connectionResult, settingsResult, threadsResult, workspaces] =
    await Promise.all([
      client
        .from('google_connections')
        .select('google_email, connected_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      client
        .from('email_assistant_settings')
        .select(
          'style_notes, signature, signature_is_html, last_synced_at, auto_triage_enabled, auto_draft_enabled, auto_save_gmail_drafts',
        )
        .eq('user_id', user.id)
        .maybeSingle(),
      client
        .from('email_threads')
        .select(
          `id, gmail_thread_id, subject, snippet, participants, is_unread, last_message_at, assistant_category, ${EMAIL_THREAD_LINK_SELECT}`,
        )
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(25),
      loadPersonalSidebarWorkspaces(),
    ]);

  const connectionRow = connectionResult.data as
    | { google_email?: string; connected_at?: string }
    | null;

  const settingsRow = settingsResult.data as
    | {
        style_notes?: string | null;
        signature?: string | null;
        signature_is_html?: boolean | null;
        last_synced_at?: string | null;
        auto_triage_enabled?: boolean | null;
        auto_draft_enabled?: boolean | null;
        auto_save_gmail_drafts?: boolean | null;
      }
    | null;

  return {
    connection: connectionRow?.google_email
      ? {
          googleEmail: connectionRow.google_email,
          connectedAt: connectionRow.connected_at ?? new Date().toISOString(),
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
    },
    threads: await enrichEmailThreadLinks(
      client,
      (threadsResult.data ?? []).map((row) =>
        mapThreadRow(row as Record<string, unknown>),
      ),
    ),
    workspaces: workspaces.map((workspace) => ({
      id: workspace.id,
      slug: workspace.slug,
      label: workspace.label,
    })),
  };
});

export async function loadEmailThreadDetailFromDb(
  threadId: string,
): Promise<EmailThreadSummary | null> {
  const client = getSupabaseServerClient();
  const user = await requireUserInServerComponent();

  const { data, error } = await client
    .from('email_threads')
    .select(
      `id, gmail_thread_id, subject, snippet, participants, is_unread, last_message_at, assistant_category, ${EMAIL_THREAD_LINK_SELECT}`,
    )
    .eq('id', threadId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const thread = mapThreadRow(data as Record<string, unknown>);
  const [enriched] = await enrichEmailThreadLinks(client, [thread]);
  return enriched ?? null;
}
