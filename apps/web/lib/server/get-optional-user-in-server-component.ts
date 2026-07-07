import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { JWTUserData } from '@kit/supabase/types';

/**
 * Optional user for public pages (marketing). Reads the session from cookies only
 * and does not call Supabase Auth, avoiding refresh storms on anonymous traffic.
 */
export const getOptionalUserInServerComponent = cache(
  async (): Promise<JWTUserData | null> => {
    const client = getSupabaseServerClient();

    // Suppress the getSession warning. Remove when the issue is fixed.
    // https://github.com/supabase/auth-js/issues/873
    // @ts-expect-error: suppressGetSessionWarning is not part of the public API
    client.auth.suppressGetSessionWarning = true;

    const { data } = await client.auth.getSession();

    // @ts-expect-error: suppressGetSessionWarning is not part of the public API
    client.auth.suppressGetSessionWarning = false;

    const user = data.session?.user;

    if (!user) {
      return null;
    }

    return {
      is_anonymous: user.is_anonymous ?? false,
      aal: 'aal1',
      email: user.email ?? '',
      phone: user.phone ?? '',
      email_confirmed_at: user.email_confirmed_at ?? null,
      app_metadata: user.app_metadata ?? {},
      user_metadata: user.user_metadata ?? {},
      id: user.id,
      amr: [],
    };
  },
);
