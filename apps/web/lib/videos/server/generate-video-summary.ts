import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { OzerAIFeature, callAI } from '~/lib/ai/router';

const MAX_TRANSCRIPT_CHARS = 40_000;
const MAX_SUMMARY_CHARS = 600;

const SYSTEM_PROMPT = `You write a short plain-text summary of a screen recording or hosted video from its transcript.
Rules:
- Return ONLY the summary paragraph — no title, bullets, markdown, or quotes.
- 1–3 sentences, max ~80 words.
- Focus on what the video covers and the main takeaway.
- Neutral, clear product/help tone. Do not invent details not supported by the transcript.`;

export function normalizeVideoSummary(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_SUMMARY_CHARS);
}

export async function generateVideoSummary(input: {
  client: SupabaseClient;
  videoId: string;
  accountId: string;
  force?: boolean;
}): Promise<string> {
  const { data: video, error: videoError } = await input.client
    .from('videos')
    .select('id, title, summary')
    .eq('id', input.videoId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (videoError) throw new Error(videoError.message);
  if (!video) throw new Error('Video not found');

  const existing = normalizeVideoSummary(video.summary);
  if (existing && !input.force) {
    return existing;
  }

  const { data: transcript, error: transcriptError } = await input.client
    .from('video_transcripts')
    .select('plain_text, status')
    .eq('video_id', input.videoId)
    .maybeSingle();

  if (transcriptError) throw new Error(transcriptError.message);
  if (!transcript || transcript.status !== 'ready') {
    throw new Error('Transcript is not ready yet');
  }

  const plainText = String(transcript.plain_text ?? '').trim();
  if (!plainText) {
    throw new Error('Transcript is empty');
  }

  const raw = await callAI({
    feature: OzerAIFeature.video_summary,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Video title: ${String(video.title ?? 'Untitled')}\n\nTranscript:\n${plainText.slice(0, MAX_TRANSCRIPT_CHARS)}`,
    accountId: input.accountId,
    supabase: input.client,
  });

  const summary = normalizeVideoSummary(raw);
  if (!summary) {
    throw new Error('AI returned an empty summary');
  }

  const { error: updateError } = await input.client
    .from('videos')
    .update({
      summary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.videoId)
    .eq('account_id', input.accountId);

  if (updateError) throw new Error(updateError.message);

  return summary;
}

/** Best-effort auto-generate after publish when summary is empty. */
export async function maybeGenerateSummaryAfterPublish(input: {
  client: SupabaseClient;
  videoId: string;
  accountId: string;
}) {
  try {
    const { data: video } = await input.client
      .from('videos')
      .select('summary')
      .eq('id', input.videoId)
      .maybeSingle();

    if (normalizeVideoSummary(video?.summary)) {
      return;
    }

    const { data: transcript } = await input.client
      .from('video_transcripts')
      .select('status')
      .eq('video_id', input.videoId)
      .maybeSingle();

    if (transcript?.status !== 'ready') {
      return;
    }

    await generateVideoSummary({
      client: input.client,
      videoId: input.videoId,
      accountId: input.accountId,
      force: false,
    });
  } catch (err) {
    console.error('[videos] auto summary generate failed', {
      videoId: input.videoId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
