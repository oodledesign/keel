import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { Database } from '../database.types';
import { getSupabaseClientKeys } from '../get-supabase-client-keys';

/**
 * Anonymous Supabase client for public server data (e.g. published blog posts).
 * Does not read cookies, so routes can render without forcing dynamic auth.
 */
export function getSupabasePublicServerClient<GenericSchema = Database>() {
  const keys = getSupabaseClientKeys();

  return createClient<GenericSchema>(keys.url, keys.publicKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
