import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Admin queries against tables that may not be in generated Database types yet.
 * Prefer this over `as any` at each call site.
 * Remove after `pnpm supabase:web:typegen` includes `extension_speaker_events`.
 */
export function untypedFrom(admin: SupabaseClient, table: string) {
  return (
    admin as unknown as {
      from: (relation: string) => ReturnType<SupabaseClient['from']>;
    }
  ).from(table);
}
