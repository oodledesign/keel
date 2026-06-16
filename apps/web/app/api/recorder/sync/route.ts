import { NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import {
  touchApiTokenLastUsed,
  validateApiTokenForAuth,
} from '~/lib/api-tokens/api-tokens.service';
import { isKeelApiTokenFormat } from '~/lib/api-tokens/token';
import { queueBrainIndexSource } from '~/lib/brain/sync';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

const SyncBodySchema = z.object({
  content: z.string().min(1),
  title: z.string().optional(),
  recorded_at: z.string().optional(),
  duration_seconds: z.number().int().optional(),
  meeting_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  client_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
});

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseBearerToken(request: Request) {
  const header = request.headers.get('authorization');
  if (!header) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

async function assertClientBelongsToAccount(
  clientId: string,
  accountId: string,
) {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return true;
}

async function assertDealBelongsToAccount(dealId: string, accountId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('pipeline_deals')
    .select('id')
    .eq('id', dealId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  const rawToken = parseBearerToken(request);
  if (!rawToken || !isKeelApiTokenFormat(rawToken)) {
    return unauthorized();
  }

  const token = await validateApiTokenForAuth(rawToken);
  if (!token) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const parsed = SyncBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest('Invalid request body');
  }

  const input = parsed.data;

  if (Buffer.byteLength(input.content, 'utf8') > MAX_CONTENT_BYTES) {
    return badRequest('Content exceeds maximum size');
  }

  if (input.duration_seconds !== undefined && input.duration_seconds < 0) {
    return badRequest('duration_seconds must not be negative');
  }

  let recordedAt: string | null = null;
  if (input.recorded_at !== undefined) {
    const parsedRecordedAt = Date.parse(input.recorded_at);
    if (Number.isNaN(parsedRecordedAt)) {
      return badRequest('Invalid recorded_at');
    }
    recordedAt = new Date(parsedRecordedAt).toISOString();
  }

  const clientId = input.client_id ?? null;
  const dealId = input.deal_id ?? null;

  if (!clientId && !dealId) {
    return badRequest('client_id or deal_id is required');
  }

  if (clientId && !(await assertClientBelongsToAccount(clientId, token.account_id))) {
    return badRequest('Invalid client_id for this workspace');
  }

  if (dealId && !(await assertDealBelongsToAccount(dealId, token.account_id))) {
    return badRequest('Invalid deal_id for this workspace');
  }

  const admin = getSupabaseServerAdminClient();
  const { data: row, error } = await admin
    .from('meeting_transcripts')
    .insert({
      account_id: token.account_id,
      created_by: token.user_id,
      client_id: clientId,
      deal_id: dealId,
      title: input.title?.trim() || 'Meeting transcript',
      content: input.content.trim(),
      source: 'desktop_recorder',
      recorded_at: recordedAt,
      duration_seconds: input.duration_seconds ?? null,
      meeting_date: input.meeting_date ?? null,
    })
    .select('id, account_id, created_at')
    .single();

  if (error || !row) {
    return NextResponse.json(
      { error: 'Failed to save meeting transcript' },
      { status: 500 },
    );
  }

  touchApiTokenLastUsed(token.id);
  queueBrainIndexSource(token.account_id, 'transcript', row.id);

  const { data: account } = await admin
    .from('accounts')
    .select('slug')
    .eq('id', token.account_id)
    .maybeSingle();

  const slug = account?.slug as string | undefined;
  const detailPath = slug
    ? workAccountPath(pathsConfig.app.accountMeetingDetail, slug).replace(
        '[transcriptId]',
        row.id,
      )
    : undefined;

  return NextResponse.json({
    id: row.id,
    account_id: row.account_id,
    created_at: row.created_at,
    ...(detailPath ? { detail_path: detailPath } : {}),
  });
}
