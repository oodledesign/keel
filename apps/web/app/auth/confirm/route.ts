import { NextRequest, NextResponse } from 'next/server';

import { createAuthCallbackService } from '@kit/supabase/auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

/**
 * Email confirmation / recovery links land here
 * (`/auth/confirm?token_hash=…&type=…&callback=…`).
 *
 * Recovery must always finish on the update-password page. Supabase may strip
 * or reject a redirect_to that isn't on the Auth allow-list, leaving callback
 * as the site origin — without this override users bounce to /app or sign-up.
 */
export async function GET(request: NextRequest) {
  const service = createAuthCallbackService(getSupabaseServerClient());
  const type = request.nextUrl.searchParams.get('type');
  const isRecovery = type === 'recovery';

  const url = await service.verifyTokenHash(request, {
    joinTeamPath: pathsConfig.app.joinTeam,
    redirectPath: isRecovery
      ? pathsConfig.auth.passwordUpdate
      : pathsConfig.app.home,
  });

  if (isRecovery && !url.searchParams.has('error')) {
    url.pathname = pathsConfig.auth.passwordUpdate;
    url.search = '';
  }

  return NextResponse.redirect(url);
}
