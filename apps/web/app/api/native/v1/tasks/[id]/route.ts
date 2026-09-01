import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { getNativeTask, updateNativeTask } from '~/lib/native/tasks';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchTaskBodySchema = z
  .object({
    status: z.string().min(1).optional(),
    due: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    title: z.string().min(1).optional(),
    client_id: z.string().uuid().nullable().optional(),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.due !== undefined ||
      value.title !== undefined ||
      value.client_id !== undefined,
    { message: 'No task fields to update' },
  );

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      new URL(request.url).searchParams.get('workspace'),
    );
    const task = await getNativeTask({
      client: auth.context.supabase,
      userId: auth.context.userId,
      taskId: id,
      workspace,
    });
    return NextResponse.json(task);
  } catch (error) {
    return handleNativeError(error, 'tasks');
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const parsed = PatchTaskBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const task = await updateNativeTask({
      client: auth.context.supabase,
      userId: auth.context.userId,
      taskId: id,
      status: parsed.data.status,
      due: parsed.data.due,
      title: parsed.data.title,
      clientId: parsed.data.client_id,
    });
    return NextResponse.json(task);
  } catch (error) {
    return handleNativeError(error, 'tasks');
  }
}
