import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { createNativeMeeting, listNativeMeetings } from '~/lib/native/meetings';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateMeetingBodySchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1),
  workspace: z.string().min(1),
  client_id: z.string().uuid(),
  meeting_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  source: z
    .enum(['paste', 'upload', 'desktop_recorder', 'iphone'])
    .optional()
    .nullable(),
  duration_seconds: z.number().nonnegative().optional().nullable(),
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
    const items = await listNativeMeetings(auth.context.supabase, workspace);
    return NextResponse.json({ items });
  } catch (error) {
    return handleNativeError(error, 'meetings');
  }
}

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = CreateMeetingBodySchema.safeParse(
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
    const meeting = await createNativeMeeting({
      client: auth.context.supabase,
      userId: auth.context.userId,
      workspace,
      title: parsed.data.title,
      content: parsed.data.content,
      clientId: parsed.data.client_id,
      meetingDate: parsed.data.meeting_date,
      source: parsed.data.source,
      durationSeconds: parsed.data.duration_seconds,
    });
    return NextResponse.json(meeting);
  } catch (error) {
    return handleNativeError(error, 'meetings');
  }
}
