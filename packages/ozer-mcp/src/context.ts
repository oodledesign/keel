import type { SupabaseClient } from '@supabase/supabase-js';

export type McpRequestContext = {
  userId: string;
  clientId: string;
  accessToken: string;
  supabase: SupabaseClient;
};
