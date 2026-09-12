import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import {
  dismissNativeTaskReview,
  parseNativeTaskReviewId,
  parseNativeTaskReviewSource,
} from '~/lib/native/task-review';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DismissBodySchema = z.object({
  workspace: z.string().min(1),
  source: z.enum(['meeting', 'email', 'meetings', 'emails']),
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
    const parsed = DismissBodySchema.safeParse(await readJsonBody(request));
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

    const result = await dismissNativeTaskReview({
      client: auth.context.supabase,
      userId: auth.context.userId,
      workspace,
      id: parseNativeTaskReviewId(id),
      source,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleNativeError(error, 'task-review');
  }
}
