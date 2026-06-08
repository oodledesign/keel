import type { SupabaseClient } from '@supabase/supabase-js';

export type McpRequestContext = {
  userId: string;
  supabase: SupabaseClient;
};
