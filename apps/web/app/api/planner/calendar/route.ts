import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  getOptionalGoogleCalendarEnv,
  isPlannerMockCalendarEnabled,
} from '~/lib/integrations/google-calendar/env';
import { listPlannerCalendarEvents } from '~/lib/integrations/google-calendar/events';

export const dynamic = 'force-dynamic';

function rangeFor(dateIso: string, mode: 'day' | 'week') {
  const start = new Date(dateIso);
  if (Number.isNaN(start.getTime())) {
    start.setTime(Date.now());
  }
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + (mode === 'week' ? 7 : 1));

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mode =
    request.nextUrl.searchParams.get('mode') === 'week' ? 'week' : 'day';
  const date = request.nextUrl.searchParams.get('date') ?? new Date().toISOString();
  const { timeMin, timeMax } = rangeFor(date, mode);
  const configured =
    Boolean(getOptionalGoogleCalendarEnv()) || isPlannerMockCalendarEnabled();

  if (!configured) {
    return NextResponse.json({
      connected: false,
      configured: false,
      events: [],
    });
  }

  try {
    const result = await listPlannerCalendarEvents(client, {
      userId: user.id,
      timeMin,
      timeMax,
    });
    return NextResponse.json({ ...result, configured });
  } catch (err) {
    return NextResponse.json(
      {
        connected: true,
        configured,
        events: [],
        error: err instanceof Error ? err.message : 'Could not load calendar',
      },
      { status: 502 },
    );
  }
}
