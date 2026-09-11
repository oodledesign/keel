import 'server-only';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { assertWorkspaceMember } from '~/lib/api-tokens/assert-workspace-member';
import {
  EXTENSION_SPEAKER_CONFIDENCE,
  EXTENSION_SPEAKER_SOURCES,
  type ExtensionSpeakerEvent,
} from '~/lib/extension/protocol';
import { untypedFrom } from '~/lib/extension/untyped-from';

const IsoDateTimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Invalid ISO timestamp',
  });

export const ExtensionSpeakerEventSchema = z.object({
  name: z.union([z.string(), z.null()]).transform((value) => {
    const trimmed = value?.trim() ?? '';
    return trimmed ? trimmed.slice(0, 120) : null;
  }),
  startedAt: IsoDateTimeSchema,
  endedAt: IsoDateTimeSchema.nullable(),
  source: z.enum(EXTENSION_SPEAKER_SOURCES),
  confidence: z.enum(EXTENSION_SPEAKER_CONFIDENCE),
});

export const IngestSpeakerEventsSchema = z.object({
  account_id: z.string().uuid().optional(),
  session_id: z.string().trim().min(1).max(160),
  meet_url: z.string().url().max(2000).optional().nullable(),
  meet_code: z.string().trim().max(64).optional().nullable(),
  events: z.array(ExtensionSpeakerEventSchema).min(1).max(200),
});

export const ListSpeakerEventsQuerySchema = z.object({
  session_id: z.string().trim().min(1).max(160),
  account_id: z.string().uuid().optional(),
  since: z.string().datetime({ offset: true }).optional(),
});

export type IngestSpeakerEventsInput = z.infer<
  typeof IngestSpeakerEventsSchema
>;

function sanitizeMeetUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.hostname !== 'meet.google.com') return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export async function ingestExtensionSpeakerEvents(input: {
  userId: string;
  defaultAccountId: string;
  body: IngestSpeakerEventsInput;
}): Promise<{ accepted: number; session_id: string }> {
  const admin = getSupabaseServerAdminClient();
  const accountId = input.body.account_id ?? input.defaultAccountId;
  await assertWorkspaceMember(admin, accountId, input.userId);

  const meetUrl = sanitizeMeetUrl(input.body.meet_url);
  const rows = input.body.events.map((event) => ({
    account_id: accountId,
    user_id: input.userId,
    session_id: input.body.session_id,
    meet_url: meetUrl,
    meet_code: input.body.meet_code?.trim() || null,
    name: event.name,
    started_at: event.startedAt,
    ended_at: event.endedAt,
    source: event.source,
    confidence: event.confidence,
  }));

  const { error } = await untypedFrom(admin, 'extension_speaker_events').insert(
    rows,
  );

  if (error) {
    throw new Error(error.message);
  }

  return { accepted: rows.length, session_id: input.body.session_id };
}

export async function listExtensionSpeakerEvents(input: {
  userId: string;
  defaultAccountId: string;
  sessionId: string;
  accountId?: string;
  since?: string;
}): Promise<{ items: ExtensionSpeakerEvent[] }> {
  const admin = getSupabaseServerAdminClient();
  const accountId = input.accountId ?? input.defaultAccountId;
  await assertWorkspaceMember(admin, accountId, input.userId);

  let query = untypedFrom(admin, 'extension_speaker_events')
    .select('name, started_at, ended_at, source, confidence')
    .eq('account_id', accountId)
    .eq('user_id', input.userId)
    .eq('session_id', input.sessionId)
    .order('started_at', { ascending: true })
    .limit(500);

  if (input.since) {
    query = query.gte('started_at', input.since);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const items = ((data ?? []) as Array<Record<string, unknown>>).map(
    (row) =>
      ({
        name: (row.name as string | null) ?? null,
        startedAt: String(row.started_at),
        endedAt: (row.ended_at as string | null) ?? null,
        source: row.source as ExtensionSpeakerEvent['source'],
        confidence: row.confidence as ExtensionSpeakerEvent['confidence'],
      }) satisfies ExtensionSpeakerEvent,
  );

  return { items };
}
