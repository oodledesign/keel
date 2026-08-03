import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';
import {
  VOICE_MAX_DISTILL_CHARS,
  VOICE_MAX_DISTILL_PER_DAY,
} from '~/lib/voice/voice.types';

const DistillSchema = z.object({
  guidance_text: z.string().min(1).max(4000),
  themes: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        description: z.string().min(1).max(400),
        examples: z.array(z.string().max(240)).max(3).default([]),
      }),
    )
    .max(8),
});

const DISTILL_SYSTEM = `You analyze writing samples and produce a concise tone-of-voice profile for AI drafting.

Return ONLY valid JSON:
{
  "guidance_text": string (8-12 sentences of actionable style instructions for an AI writer),
  "themes": [{ "title": string, "description": string, "examples": string[] }]
}

Rules:
- Capture voice, rhythm, formality, warmth, jargon, sign-offs, and things to avoid.
- Themes should be concrete and editable (e.g. "Warm but direct openings").
- examples are short phrases that sound like the writer (0-2 per theme).
- Do not invent biographical facts. Base everything on the samples.
- British or American English: match the samples.`;

export async function distillVoiceProfile(
  client: SupabaseClient,
  profileId: string,
  options?: { replaceManualThemes?: boolean },
): Promise<{ guidanceText: string; themeCount: number }> {
  const { data: profile, error: profileError } = await client
    .from('voice_profiles')
    .select(
      'id, status, distill_count, distill_count_day, learn_from_sent_email',
    )
    .eq('id', profileId)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? 'Voice profile not found');
  }

  const today = new Date().toISOString().slice(0, 10);
  const countDay = (profile as { distill_count_day?: string | null })
    .distill_count_day;
  const count =
    countDay === today
      ? Number((profile as { distill_count?: number }).distill_count ?? 0)
      : 0;

  if (count >= VOICE_MAX_DISTILL_PER_DAY) {
    throw new Error(
      `Voice rebuild limit reached (${VOICE_MAX_DISTILL_PER_DAY}/day). Try again tomorrow.`,
    );
  }

  await client
    .from('voice_profiles')
    .update({ status: 'updating' })
    .eq('id', profileId);

  try {
    const { data: sources, error: sourcesError } = await client
      .from('voice_sources')
      .select('title, content_text, type, created_at')
      .eq('profile_id', profileId)
      .eq('included', true)
      .order('created_at', { ascending: false })
      .limit(40);

    if (sourcesError) {
      throw new Error(sourcesError.message);
    }

    const chunks: string[] = [];
    let used = 0;
    for (const row of sources ?? []) {
      const title = ((row as { title?: string }).title ?? 'Sample').trim();
      const text = (
        (row as { content_text?: string }).content_text ?? ''
      ).trim();
      if (!text) continue;
      const block = `### ${title}\n${text}`;
      if (used + block.length > VOICE_MAX_DISTILL_CHARS) {
        const remaining = VOICE_MAX_DISTILL_CHARS - used;
        if (remaining > 200) {
          chunks.push(block.slice(0, remaining));
        }
        break;
      }
      chunks.push(block);
      used += block.length;
    }

    if (chunks.length === 0) {
      throw new Error('Add writing samples before rebuilding your voice');
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const model = resolveAnthropicModel();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        system: DISTILL_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Writing samples:\n\n${chunks.join('\n\n')}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Voice distill failed (${response.status}): ${(await response.text()).slice(0, 300)}`,
      );
    }

    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const raw = payload.content
      ?.filter((part) => part.type === 'text' && part.text)
      .map((part) => part.text)
      .join('\n')
      ?.trim();

    if (!raw) {
      throw new Error('Voice distill returned empty content');
    }

    const jsonText = extractJsonObject(raw);
    const parsed = DistillSchema.parse(JSON.parse(jsonText));

    await client
      .from('voice_profiles')
      .update({
        guidance_text: parsed.guidance_text.trim(),
        status: 'ready',
        last_distilled_at: new Date().toISOString(),
        distill_count_day: today,
        distill_count: count + 1,
      })
      .eq('id', profileId);

    // Remove previous distilled themes; keep manual unless full replace.
    await client
      .from('voice_themes')
      .delete()
      .eq('profile_id', profileId)
      .eq('source', 'distilled');

    if (options?.replaceManualThemes) {
      await client
        .from('voice_themes')
        .delete()
        .eq('profile_id', profileId)
        .eq('source', 'manual');
    }

    if (parsed.themes.length > 0) {
      const rows = parsed.themes.map((theme, index) => ({
        profile_id: profileId,
        title: theme.title.trim(),
        description: theme.description.trim(),
        examples: theme.examples.map((item) => item.trim()).filter(Boolean),
        source: 'distilled' as const,
        weight: parsed.themes.length - index,
      }));
      const { error: themeError } = await client
        .from('voice_themes')
        .insert(rows);
      if (themeError) {
        throw new Error(themeError.message);
      }
    }

    return {
      guidanceText: parsed.guidance_text.trim(),
      themeCount: parsed.themes.length,
    };
  } catch (error) {
    await client
      .from('voice_profiles')
      .update({ status: 'draft' })
      .eq('id', profileId);
    throw error;
  }
}

function extractJsonObject(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw;
}
