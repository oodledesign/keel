import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { ensureVoiceProfile } from '~/lib/voice/ensure-voice-profile';
import { mapVoiceSource, mapVoiceTheme } from '~/lib/voice/map-voice-rows';
import type { VoiceProfilePageData } from '~/lib/voice/voice.types';

export async function loadPersonalVoicePageData(
  client: SupabaseClient,
  userId: string,
): Promise<VoiceProfilePageData> {
  const profile = await ensureVoiceProfile(client, {
    kind: 'personal',
    userId,
  });
  return loadProfileChildren(client, profile);
}

export async function loadBrandVoicePageData(
  client: SupabaseClient,
  accountId: string,
): Promise<VoiceProfilePageData> {
  const profile = await ensureVoiceProfile(client, {
    kind: 'brand',
    accountId,
  });
  return loadProfileChildren(client, profile);
}

async function loadProfileChildren(
  client: SupabaseClient,
  profile: VoiceProfilePageData['profile'],
): Promise<VoiceProfilePageData> {
  const [{ data: themeRows }, { data: sourceRows }] = await Promise.all([
    client
      .from('voice_themes')
      .select('*')
      .eq('profile_id', profile.id)
      .order('weight', { ascending: false })
      .order('created_at', { ascending: true }),
    client
      .from('voice_sources')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false }),
  ]);

  return {
    profile,
    themes: (themeRows ?? []).map((row) =>
      mapVoiceTheme(row as Record<string, unknown>),
    ),
    sources: (sourceRows ?? []).map((row) =>
      mapVoiceSource(row as Record<string, unknown>),
    ),
  };
}
