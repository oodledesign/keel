import { type NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createPlannerCalendarEvents } from '~/lib/integrations/google-calendar/events';

export const dynamic = 'force-dynamic';

const blockSchema = z.object({
  title: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
});

const pushSchema = z.object({
  date: z.string().min(1),
  planMarkdown: z.string().optional(),
  blocks: z.array(blockSchema).optional(),
});

const scheduledLineRe =
  /^(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})\s*·\s*(?!📅)(.+?)(?:\s*·\s*.+)?$/;

function parseBlocksFromMarkdown(markdown: string, dateIso: string) {
  const base = new Date(dateIso);
  const blocks: Array<{ title: string; start: string; end: string }> = [];

  if (Number.isNaN(base.getTime())) {
    return blocks;
  }

  for (const line of markdown.split('\n')) {
    const match = scheduledLineRe.exec(line.trim());
    if (!match) continue;

    const [, startTime, endTime, rawTitle] = match;
    if (!startTime || !endTime || !rawTitle) continue;
    const start = new Date(base);
    const end = new Date(base);
    const [startHour = 0, startMinute = 0] = startTime.split(':').map(Number);
    const [endHour = 0, endMinute = 0] = endTime.split(':').map(Number);

    start.setHours(startHour, startMinute, 0, 0);
    end.setHours(endHour, endMinute, 0, 0);
    if (end <= start) continue;

    blocks.push({
      title: rawTitle.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }

  return blocks;
}

export async function POST(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = pushSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid calendar push request',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const blocks = parsed.data.blocks?.length
    ? parsed.data.blocks
    : parsed.data.planMarkdown
      ? parseBlocksFromMarkdown(parsed.data.planMarkdown, parsed.data.date)
      : [];

  if (blocks.length === 0) {
    return NextResponse.json(
      { error: 'No scheduled task blocks found to push' },
      { status: 400 },
    );
  }

  try {
    const result = await createPlannerCalendarEvents(client, {
      userId: user.id,
      blocks,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Could not push calendar events',
      },
      { status: 502 },
    );
  }
}
