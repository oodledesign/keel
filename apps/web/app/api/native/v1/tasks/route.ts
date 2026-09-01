import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { createNativeTask, listNativeTasks } from '~/lib/native/tasks';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateTaskBodySchema = z.object({
  title: z.string().min(1),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  workspace: z.string().min(1),
  client_id: z.string().uuid().optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      url.searchParams.get('workspace'),
    );
    const tasks = await listNativeTasks(
      auth.context.supabase,
      auth.context.userId,
      workspace,
      {
        day: url.searchParams.get('day'),
        clientId: url.searchParams.get('client'),
        status: url.searchParams.get('status'),
        q: url.searchParams.get('q'),
      },
    );
    return NextResponse.json({ items: tasks });
  } catch (error) {
    return handleNativeError(error, 'tasks');
  }
}

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = CreateTaskBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );
    const task = await createNativeTask({
      userId: auth.context.userId,
      workspace,
      title: parsed.data.title,
      due: parsed.data.due,
      clientId: parsed.data.client_id,
      client: auth.context.supabase,
    });
    return NextResponse.json(task);
  } catch (error) {
    return handleNativeError(error, 'tasks');
  }
}
