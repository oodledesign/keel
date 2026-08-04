import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { callAI } from '~/lib/ai/router';

export async function summarizeMeetupTranscript(
  transcript: string,
  meetupTitle: string,
  meter: { accountId: string; supabase: SupabaseClient },
): Promise<string> {
  const system = `You summarize home group / community meetup notes for leaders.
Write a clear, warm summary in markdown with sections: Highlights, Discussion, Prayer & pastoral care, Action items, Next time.
Keep it concise (under 400 words). Do not invent facts not present in the transcript.`;

  const userContent = `Meetup title: ${meetupTitle}

Transcript / raw notes:
---
${transcript.slice(0, 80_000)}
---`;

  const text = await callAI({
    feature: 'meetup_summary',
    systemPrompt: system,
    userPrompt: userContent,
    accountId: meter.accountId,
    supabase: meter.supabase,
  });
  if (!text?.trim()) {
    throw new Error('Empty summary from Anthropic');
  }
  return text;
}
