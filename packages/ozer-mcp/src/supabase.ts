import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAnonKey, getSupabaseUrl } from './config';

export function createOzerMcpSupabaseClient(
  accessToken: string,
): SupabaseClient {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error(
      'Ozer MCP requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and NEXT_PUBLIC_SUPABASE_PUBLIC_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).',
    );
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
