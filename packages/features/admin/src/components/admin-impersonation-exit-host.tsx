import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  getImpersonationExitState,
  readImpersonationSessionIdFromCookie,
} from '../lib/server/utils/impersonation-session';
import { AdminClearStaleImpersonationCookie } from './admin-clear-stale-impersonation-cookie';
import { AdminImpersonationExitButton } from './admin-impersonation-exit-button';

/**
 * Server host for the floating “Back to admin” control.
 * Renders only when a valid impersonation restore cookie is present.
 */
export async function AdminImpersonationExitHost() {
  const sessionId = await readImpersonationSessionIdFromCookie();

  if (!sessionId) {
    return null;
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    // Signed out (e.g. from marketing) while the restore cookie remains.
    return <AdminClearStaleImpersonationCookie />;
  }

  const adminClient = getSupabaseServerAdminClient();
  const state = await getImpersonationExitState({
    adminClient,
    currentUserId: user.id,
    viewingAsEmail: user.email ?? null,
  });

  if (!state.active) {
    // Cookie no longer matches the signed-in user (common after logout + re-login).
    return <AdminClearStaleImpersonationCookie />;
  }

  return <AdminImpersonationExitButton viewingAsEmail={state.viewingAsEmail} />;
}
