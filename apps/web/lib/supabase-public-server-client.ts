import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { getSupabaseClientKeys } from '@kit/supabase/get-supabase-client-keys';

import type { Database } from '~/lib/database.types';

/**
 * Anonymous Supabase client for public marketing data (e.g. published blog posts).
 * Does not read cookies, so blog routes can render without forcing dynamic auth.
 */
export function getSupabasePublicServerClient() {
  const keys = getSupabaseClientKeys();

  return createClient<Database>(keys.url, keys.publicKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
