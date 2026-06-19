import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import { getRecorderCalendarEvent } from '~/lib/integrations/google-calendar/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateRecorderRequest(request, { touchLastUsed: true });
  if (auth instanceof NextResponse) {
    return auth;
  }

  const admin = getSupabaseServerAdminClient();

  try {
    const result = await getRecorderCalendarEvent(admin, { userId: auth.user_id });
    const { data: userData } = await admin.auth.admin.getUserById(auth.user_id);

    return NextResponse.json({
      ...result,
      user_email: userData?.user?.email?.trim() || null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Could not load calendar event',
      },
      { status: 502 },
    );
  }
}
