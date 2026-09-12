import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import {
  acceptNativeTaskReview,
  parseNativeTaskReviewDue,
  parseNativeTaskReviewId,
  parseNativeTaskReviewSource,
} from '~/lib/native/task-review';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AcceptBodySchema = z.object({
  workspace: z.string().min(1),
  source: z.enum(['meeting', 'email', 'meetings', 'emails']),
  title: z.string().min(1).max(500).optional(),
  detail: z.string().max(5000).nullable().optional(),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  duration_minutes: z
    .number()
    .int()
    .positive()
    .max(10080)
    .nullable()
    .optional(),
  client_id: z.string().uuid().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const parsed = AcceptBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const source = parseNativeTaskReviewSource(parsed.data.source);
    if (source === 'all') {
      return nativeBadRequest('source must be meeting or email');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );

    const result = await acceptNativeTaskReview({
      client: auth.context.supabase,
      userId: auth.context.userId,
      workspace,
      id: parseNativeTaskReviewId(id),
      source,
      patch: {
        title: parsed.data.title,
        detail: parsed.data.detail,
        due: parseNativeTaskReviewDue(parsed.data.due),
        durationMinutes: parsed.data.duration_minutes,
        clientId: parsed.data.client_id,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleNativeError(error, 'task-review');
  }
}
