import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { mapVoiceProfile } from '~/lib/voice/map-voice-rows';
import type { VoiceProfile } from '~/lib/voice/voice.types';

/**
 * Ensure a personal or brand voice profile exists.
 * Seeds personal guidance from email_assistant_settings.style_notes when present.
 */
export async function ensureVoiceProfile(
  client: SupabaseClient,
  input:
    | { kind: 'personal'; userId: string }
    | { kind: 'brand'; accountId: string },
): Promise<VoiceProfile> {
  if (input.kind === 'personal') {
    const { data: existing } = await client
      .from('voice_profiles')
      .select('*')
      .eq('kind', 'personal')
      .eq('owner_user_id', input.userId)
      .maybeSingle();

    if (existing) {
      return mapVoiceProfile(existing as Record<string, unknown>);
    }

    let guidance: string | null = null;
    const { data: settingsRows } = await client
      .from('email_assistant_settings')
      .select('style_notes')
      .eq('user_id', input.userId)
      .limit(5);

    for (const row of settingsRows ?? []) {
      const notes = (
        row as { style_notes?: string | null }
      ).style_notes?.trim();
      if (notes) {
        guidance = notes;
        break;
      }
    }

    const { data: created, error } = await client
      .from('voice_profiles')
      .insert({
        kind: 'personal',
        owner_user_id: input.userId,
        account_id: null,
        status: guidance ? 'ready' : 'draft',
        guidance_text: guidance,
      })
      .select('*')
      .single();

    if (error || !created) {
      throw new Error(
        error?.message ?? 'Could not create personal voice profile',
      );
    }

    if (guidance) {
      await client.from('voice_themes').insert({
        profile_id: (created as { id: string }).id,
        title: 'Writing style notes',
        description: guidance.slice(0, 500),
        examples: [],
        source: 'manual',
        weight: 10,
      });
    }

    return mapVoiceProfile(created as Record<string, unknown>);
  }

  const { data: existing } = await client
    .from('voice_profiles')
    .select('*')
    .eq('kind', 'brand')
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (existing) {
    return mapVoiceProfile(existing as Record<string, unknown>);
  }

  const { data: created, error } = await client
    .from('voice_profiles')
    .insert({
      kind: 'brand',
      owner_user_id: null,
      account_id: input.accountId,
      status: 'draft',
      guidance_text: null,
    })
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? 'Could not create brand voice profile');
  }

  return mapVoiceProfile(created as Record<string, unknown>);
}
