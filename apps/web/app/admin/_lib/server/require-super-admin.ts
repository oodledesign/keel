import 'server-only';

import { redirect } from 'next/navigation';

import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

/** Verify super-admin access; redirects home if unauthorized. Returns user id. */
export async function requireSuperAdmin(): Promise<string> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect(pathsConfig.app.home);
  }

  if (!(await isSuperAdmin(client))) {
    redirect(pathsConfig.app.home);
  }

  return user.id;
}
