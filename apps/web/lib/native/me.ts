import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { NativeHttpError } from './http';
import { loadPersonalNativeWorkspace } from './workspace';

function metadataDisplayName(
  metadata: Record<string, unknown> | undefined,
): string | null {
  if (!metadata) return null;

  const candidates = [metadata.display_name, metadata.full_name, metadata.name];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export async function loadNativeMe(
  client: SupabaseClient,
  userId: string,
  tokenEmail: string | null,
) {
  const [{ data: userResult }, personal, { data: settings }] =
    await Promise.all([
      client.auth.getUser(),
      loadPersonalNativeWorkspace(client, userId),
      client
        .from('user_settings')
        .select('first_name, last_name')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

  if (!personal) {
    throw new NativeHttpError(404, 'Personal workspace not found');
  }

  const user = userResult.user;
  const email = user?.email?.trim() || tokenEmail?.trim() || null;
  const settingsName = [settings?.first_name, settings?.last_name]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' ');

  const displayName =
    metadataDisplayName(user?.user_metadata as Record<string, unknown>) ||
    personal.name ||
    settingsName ||
    email?.split('@')[0]?.trim() ||
    'You';

  return {
    id: userId,
    email,
    display_name: displayName,
    personal_account: {
      id: personal.id,
      slug: personal.slug,
    },
  };
}
