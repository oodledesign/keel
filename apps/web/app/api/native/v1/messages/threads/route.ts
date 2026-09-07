import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import {
  createNativeMessageThread,
  listNativeMessageThreads,
} from '~/lib/native/messages';
import { inferNativeComposeType } from '~/lib/native/messages-shared';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateThreadBodySchema = z.object({
  workspace: z.string().min(1),
  type: z.enum(['direct', 'group', 'job', 'client']).optional(),
  title: z.string().max(180).optional(),
  job_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  member_user_ids: z.array(z.string().uuid()).optional(),
  contact_ids: z.array(z.string().uuid()).optional(),
  client_ids: z.array(z.string().uuid()).optional(),
});

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      new URL(request.url).searchParams.get('workspace'),
    );
    const items = await listNativeMessageThreads(
      auth.context.userId,
      workspace,
    );
    return NextResponse.json({ items });
  } catch (error) {
    return handleNativeError(error, 'messages/threads');
  }
}

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = CreateThreadBodySchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );

    const type =
      parsed.data.type ??
      inferNativeComposeType({
        people: (parsed.data.member_user_ids ?? []).map((id) => ({
          id,
          name: id,
        })),
        contacts: (parsed.data.contact_ids ?? []).map((id) => ({
          id,
          name: id,
        })),
        client: parsed.data.client_id
          ? { id: parsed.data.client_id, name: parsed.data.client_id }
          : null,
        job: parsed.data.job_id
          ? { id: parsed.data.job_id, title: parsed.data.job_id }
          : null,
      });

    const created = await createNativeMessageThread({
      userId: auth.context.userId,
      workspace,
      type,
      title: parsed.data.title,
      jobId: parsed.data.job_id,
      clientId: parsed.data.client_id,
      memberUserIds: parsed.data.member_user_ids,
      contactIds: parsed.data.contact_ids,
      clientIds: parsed.data.client_ids,
    });

    return NextResponse.json(created);
  } catch (error) {
    return handleNativeError(error, 'messages/threads');
  }
}
