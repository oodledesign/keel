import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getUserDefaultLandingPath } from './load-shortcuts';

export async function resolvePostAuthLandingPath(
  client: SupabaseClient,
  userId: string,
  nextPath: string | null | undefined,
  fallbackPath: string,
): Promise<string> {
  const trimmed = nextPath?.trim();
  if (trimmed && trimmed !== '/' && trimmed !== fallbackPath) {
    return trimmed;
  }

  try {
    return await getUserDefaultLandingPath(client, userId);
  } catch {
    return fallbackPath;
  }
}
