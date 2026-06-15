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
  return {
    id: String(row.id),
    gmail_thread_id: String(row.gmail_thread_id),
    subject: (row.subject as string | null) ?? null,
    snippet: (row.snippet as string | null) ?? null,
    participants: parseParticipants(row.participants),
    is_unread: Boolean(row.is_unread),
    last_message_at: (row.last_message_at as string | null) ?? null,
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
        .select('style_notes, signature, last_synced_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      client
        .from('email_threads')
        .select(
          'id, gmail_thread_id, subject, snippet, participants, is_unread, last_message_at',
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
        last_synced_at?: string | null;
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
      lastSyncedAt: settingsRow?.last_synced_at ?? null,
    },
    threads: (threadsResult.data ?? []).map((row) =>
      mapThreadRow(row as Record<string, unknown>),
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
      'id, gmail_thread_id, subject, snippet, participants, is_unread, last_message_at',
    )
    .eq('id', threadId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapThreadRow(data as Record<string, unknown>);
}
