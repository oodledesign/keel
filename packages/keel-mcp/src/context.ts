import type { SupabaseClient } from '@supabase/supabase-js';

export type McpRequestContext = {
  userId: string;
  clientId: string | null;
  accessToken: string;
  supabase: SupabaseClient;
};
