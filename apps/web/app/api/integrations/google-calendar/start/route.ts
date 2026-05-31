import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { buildGoogleCalendarAuthUrl } from '~/lib/integrations/google-calendar/oauth';

export const dynamic = 'force-dynamic';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function GET(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.redirect(absoluteUrl(pathsConfig.auth.signIn));
  }

  const returnPath =
    request.nextUrl.searchParams.get('returnPath') ??
    pathsConfig.app.personalPlanner;

  try {
    return NextResponse.redirect(
      buildGoogleCalendarAuthUrl({
        userId: user.id,
        returnPath,
      }),
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Google Calendar is not configured';
    return NextResponse.redirect(
      absoluteUrl(
        `${pathsConfig.app.personalPlanner}?calendar_error=${encodeURIComponent(message)}`,
      ),
    );
  }
}
