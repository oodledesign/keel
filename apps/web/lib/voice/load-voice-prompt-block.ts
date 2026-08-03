import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { mapVoiceTheme } from '~/lib/voice/map-voice-rows';
import type { VoicePromptPurpose } from '~/lib/voice/voice.types';

/**
 * Compact voice context for LLM prompts (~400–800 tokens).
 * Email → personal; proposal → brand if present, else personal.
 */
export async function loadVoicePromptBlock(
  client: SupabaseClient,
  input: {
    userId: string;
    accountId?: string | null;
    purpose: VoicePromptPurpose;
    /** Fallback when no voice profile guidance exists (e.g. style_notes). */
    fallbackStyleNotes?: string | null;
  },
): Promise<string | null> {
  let guidance: string | null = null;
  let themes: Array<{
    title: string;
    description: string;
    examples: string[];
  }> = [];

  if (input.purpose === 'proposal' && input.accountId) {
    const { data: brand } = await client
      .from('voice_profiles')
      .select('id, guidance_text')
      .eq('kind', 'brand')
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (brand) {
      guidance = (brand as { guidance_text?: string | null }).guidance_text;
      themes = await loadThemes(client, (brand as { id: string }).id);
    }
  }

  if (!guidance?.trim() && themes.length === 0) {
    const { data: personal } = await client
      .from('voice_profiles')
      .select('id, guidance_text')
      .eq('kind', 'personal')
      .eq('owner_user_id', input.userId)
      .maybeSingle();

    if (personal) {
      guidance = (personal as { guidance_text?: string | null }).guidance_text;
      themes = await loadThemes(client, (personal as { id: string }).id);
    }
  }

  if (!guidance?.trim() && themes.length === 0) {
    const fallback = input.fallbackStyleNotes?.trim();
    return fallback ? `Owner style notes:\n${fallback}` : null;
  }

  const parts: string[] = ['Tone of voice (match this writing style):'];

  if (guidance?.trim()) {
    parts.push(guidance.trim().slice(0, 1200));
  }

  const topThemes = themes.slice(0, 3);
  if (topThemes.length > 0) {
    parts.push('Themes:');
    for (const theme of topThemes) {
      const line = `- ${theme.title}: ${theme.description}`.trim();
      parts.push(line.slice(0, 220));
      const exemplar = theme.examples[0]?.trim();
      if (exemplar) {
        parts.push(`  e.g. "${exemplar.slice(0, 160)}"`);
      }
    }
  }

  return parts.join('\n').slice(0, 2400);
}

async function loadThemes(client: SupabaseClient, profileId: string) {
  const { data } = await client
    .from('voice_themes')
    .select('title, description, examples, weight')
    .eq('profile_id', profileId)
    .order('weight', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(8);

  return (data ?? []).map((row) =>
    mapVoiceTheme(row as Record<string, unknown>),
  );
}
