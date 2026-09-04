import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import {
  createRecorderNote,
  listRecorderNotes,
} from '~/lib/recorder/create-note';
import { parseRecorderNotesListQuery } from '~/lib/recorder/list-notes-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateBodySchema = z.object({
  content: z.string().min(1),
  account_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  source: z.string().optional().nullable(),
  created_at: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  const query = parseRecorderNotesListQuery(new URL(request.url).searchParams);

  try {
    const rows = await listRecorderNotes({
      userId: auth.user_id,
      accountId: query.accountId,
      limit: query.limit + 1,
      offset: query.offset,
      clientId: query.clientId,
      category: query.category,
      q: query.q,
    });
    const hasMore = rows.length > query.limit;
    return NextResponse.json({
      items: hasMore ? rows.slice(0, query.limit) : rows,
      has_more: hasMore,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load notes';
    const status = message.includes('not a member') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  try {
    const result = await createRecorderNote({
      userId: auth.user_id,
      content: parsed.data.content,
      accountId: parsed.data.account_id,
      clientId: parsed.data.client_id,
      projectId: parsed.data.project_id,
      source: parsed.data.source,
      createdAt: parsed.data.created_at,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create note';
    const status = message.includes('not a member') ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
