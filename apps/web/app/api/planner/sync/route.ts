import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { syncPlannerCalendarEvents } from '~/lib/integrations/google-calendar/events';

export const dynamic = 'force-dynamic';

const blockSchema = z.object({
  blockId: z.string().min(1),
  title: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  isCalendarEvent: z.boolean(),
  isBreak: z.boolean(),
  googleEventId: z.string().nullable(),
  googleCalendarId: z.string().nullable(),
  pushedByPlanner: z.boolean(),
});

const syncSchema = z.object({
  date: z.string().min(1),
  blocks: z.array(blockSchema).min(1),
});

export async function POST(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = syncSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid calendar sync request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await syncPlannerCalendarEvents(client, {
      userId: user.id,
      blocks: parsed.data.blocks,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Could not sync calendar events',
      },
      { status: 502 },
    );
  }
}
