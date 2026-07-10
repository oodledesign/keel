import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import {
  MAX_ACTIVITY_BLOCKS_PER_UPLOAD,
  uploadActivityBlocks,
} from '~/lib/recorder/activity-blocks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ActivityBlockSchema = z.object({
  app_name: z.string().min(1),
  bundle_id: z.string(),
  domain: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  window_title: z.string(),
  repo_name: z.string().nullable().optional(),
  started_at: z.string().min(1),
  ended_at: z.string().min(1),
  duration_seconds: z.number().int().nonnegative(),
});

const UploadBodySchema = z.object({
  account_id: z.string().uuid().optional(),
  blocks: z
    .array(ActivityBlockSchema)
    .min(1)
    .max(MAX_ACTIVITY_BLOCKS_PER_UPLOAD),
});

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const auth = await authenticateRecorderRequest(request, { touchLastUsed: true });
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const parsed = UploadBodySchema.safeParse(body);
  if (!parsed.success) {
    return badRequest('Invalid request body');
  }

  const targetAccountId = parsed.data.account_id ?? auth.account_id;

  try {
    const result = await uploadActivityBlocks({
      userId: auth.user_id,
      accountId: targetAccountId,
      blocks: parsed.data.blocks,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to upload activity blocks';

    if (message.includes('not a member')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message.includes('Activity tracking is disabled')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (
      message.includes('Too many blocks') ||
      message.includes('At least one activity block')
    ) {
      return badRequest(message);
    }

    if (
      message.includes('Invalid') ||
      message.includes('requires app_name') ||
      message.includes('duration_seconds') ||
      message.includes('ended_at')
    ) {
      return badRequest(message);
    }

    if (message.includes('activity_blocks') || message.includes('does not exist')) {
      return NextResponse.json(
        {
          error:
            'Activity tracking tables are not available yet. Apply the activity tracking migration to this database.',
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
