import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { OzerAIFeature, callAI } from '~/lib/ai/router';
import {
  type VideoEditTimeline,
  type VideoTranscriptWord,
  editedDurationMs,
  normalizeTimeline,
  sourceMsToEditedMs,
} from '~/lib/videos/edit-timeline';
import type { VideoChapter } from '~/lib/videos/types';

const MAX_TRANSCRIPT_CHARS = 60_000;
const MIN_CHAPTERS = 2;
const MAX_CHAPTERS = 20;

const ChapterDraftSchema = z.object({
  title: z.string().min(1).max(120),
  startMs: z.number().nonnegative(),
});

const ChaptersResponseSchema = z.object({
  chapters: z.array(ChapterDraftSchema).min(1).max(MAX_CHAPTERS),
});

function formatMsClock(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Build a timed transcript excerpt for the model (source-time stamps). */
export function buildTimedTranscriptExcerpt(
  words: VideoTranscriptWord[],
  plainText: string,
): string {
  if (words.length === 0) {
    return plainText.trim().slice(0, MAX_TRANSCRIPT_CHARS);
  }

  const lines: string[] = [];
  let bucketStart = words[0]?.startMs ?? 0;
  let bucketText: string[] = [];
  const BUCKET_MS = 20_000;

  for (const word of words) {
    if (word.startMs - bucketStart >= BUCKET_MS && bucketText.length > 0) {
      lines.push(`[${formatMsClock(bucketStart)}] ${bucketText.join(' ')}`);
      bucketStart = word.startMs;
      bucketText = [];
    }
    bucketText.push(word.text);
  }

  if (bucketText.length > 0) {
    lines.push(`[${formatMsClock(bucketStart)}] ${bucketText.join(' ')}`);
  }

  return lines.join('\n').slice(0, MAX_TRANSCRIPT_CHARS);
}

function newChapterId() {
  return crypto.randomUUID();
}

/**
 * Map AI source-time chapters onto playback time when a published timeline
 * has cuts. Chapters that land entirely in deleted ranges are dropped.
 */
export function mapChaptersToPlayback(
  drafts: Array<{ title: string; startMs: number }>,
  timeline: VideoEditTimeline | null,
): VideoChapter[] {
  const playbackDurationMs = timeline
    ? editedDurationMs(timeline.keepRanges)
    : null;

  const mapped: VideoChapter[] = [];

  for (const draft of drafts) {
    const title = draft.title.trim();
    if (!title) continue;

    let startMs = Math.max(0, Math.round(draft.startMs));

    if (timeline) {
      const edited = sourceMsToEditedMs(timeline.keepRanges, startMs);
      if (edited == null) {
        // Snap forward to the next kept source range (point is in a cut).
        let snapped: number | null = null;
        for (const range of timeline.keepRanges) {
          if (range.startMs >= startMs) {
            snapped = sourceMsToEditedMs(timeline.keepRanges, range.startMs);
            break;
          }
        }
        if (snapped == null) continue;
        startMs = snapped;
      } else {
        startMs = edited;
      }
    }

    if (playbackDurationMs != null && startMs > playbackDurationMs) {
      continue;
    }

    mapped.push({
      id: newChapterId(),
      title: title.slice(0, 120),
      startMs,
    });
  }

  // Ensure first chapter starts at 0 when we have any chapters.
  if (mapped.length > 0 && mapped[0]!.startMs > 2_000) {
    mapped.unshift({
      id: newChapterId(),
      title: 'Intro',
      startMs: 0,
    });
  } else if (mapped.length > 0) {
    mapped[0] = { ...mapped[0]!, startMs: 0 };
  }

  // Sort + dedupe near-identical starts.
  mapped.sort((a, b) => a.startMs - b.startMs);
  const deduped: VideoChapter[] = [];
  for (const chapter of mapped) {
    const prev = deduped[deduped.length - 1];
    if (prev && chapter.startMs - prev.startMs < 3_000) {
      continue;
    }
    deduped.push(chapter);
  }

  return deduped.slice(0, MAX_CHAPTERS);
}

export function normalizeVideoChapters(value: unknown): VideoChapter[] {
  if (!Array.isArray(value)) return [];

  const chapters: VideoChapter[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const id =
      typeof (row as { id?: unknown }).id === 'string' &&
      (row as { id: string }).id.trim()
        ? (row as { id: string }).id.trim()
        : newChapterId();
    const title =
      typeof (row as { title?: unknown }).title === 'string'
        ? (row as { title: string }).title.trim()
        : '';
    const startMs = Number((row as { startMs?: unknown }).startMs);
    if (!title || !Number.isFinite(startMs) || startMs < 0) continue;
    chapters.push({
      id,
      title: title.slice(0, 120),
      startMs: Math.round(startMs),
    });
  }

  return chapters.sort((a, b) => a.startMs - b.startMs);
}

const SYSTEM_PROMPT = `You create concise video chapters from a timed transcript of a screen recording.
Return ONLY valid JSON, no prose, no markdown fences:
{
  "chapters": [
    { "title": string, "startMs": number }
  ]
}

Rules:
- Produce ${MIN_CHAPTERS}-${MAX_CHAPTERS} chapters covering the whole video.
- Titles are short (2–6 words), specific, and scannable — not generic like "Part 1".
- startMs is milliseconds from the start of the SOURCE recording (use the [m:ss] timestamps).
- The first chapter should start at 0.
- Prefer natural topic / section boundaries over fixed intervals.
- Use [] only if the transcript is empty or unusable.`;

export async function generateVideoChapters(input: {
  client: SupabaseClient;
  videoId: string;
  accountId: string;
  /** When true, overwrite existing chapters. */
  force?: boolean;
}): Promise<VideoChapter[]> {
  const { data: video, error: videoError } = await input.client
    .from('videos')
    .select('id, title, chapters, published_timeline, duration_seconds')
    .eq('id', input.videoId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (videoError) throw new Error(videoError.message);
  if (!video) throw new Error('Video not found');

  const existing = normalizeVideoChapters(video.chapters);
  if (existing.length > 0 && !input.force) {
    return existing;
  }

  const { data: transcript, error: transcriptError } = await input.client
    .from('video_transcripts')
    .select('plain_text, words, status')
    .eq('video_id', input.videoId)
    .maybeSingle();

  if (transcriptError) throw new Error(transcriptError.message);

  if (!transcript || transcript.status !== 'ready') {
    throw new Error('Transcript is not ready yet');
  }

  const plainText = String(transcript.plain_text ?? '').trim();
  const words = (
    Array.isArray(transcript.words) ? transcript.words : []
  ) as VideoTranscriptWord[];

  if (!plainText && words.length === 0) {
    throw new Error('Transcript is empty');
  }

  const timed = buildTimedTranscriptExcerpt(words, plainText);
  const durationHint =
    typeof video.duration_seconds === 'number' && video.duration_seconds > 0
      ? `\nApproximate duration: ${Math.round(video.duration_seconds)} seconds.`
      : '';

  const raw = await callAI({
    feature: OzerAIFeature.video_chapters,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Video title: ${String(video.title ?? 'Untitled')}${durationHint}\n\nTimed transcript:\n${timed}`,
    accountId: input.accountId,
    supabase: input.client,
  });

  let parsedJson: unknown;
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    parsedJson = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid chapter JSON');
  }

  const parsed = ChaptersResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error('AI chapter response failed validation');
  }

  const timeline = video.published_timeline
    ? (normalizeTimeline(video.published_timeline) as VideoEditTimeline)
    : null;

  const chapters = mapChaptersToPlayback(parsed.data.chapters, timeline);

  if (chapters.length === 0) {
    throw new Error('No chapters could be generated from this transcript');
  }

  const { error: updateError } = await input.client
    .from('videos')
    .update({
      chapters,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.videoId)
    .eq('account_id', input.accountId);

  if (updateError) throw new Error(updateError.message);

  return chapters;
}

/** Best-effort auto-generate after publish when chapters are empty. */
export async function maybeGenerateChaptersAfterPublish(input: {
  client: SupabaseClient;
  videoId: string;
  accountId: string;
}) {
  try {
    const { data: video } = await input.client
      .from('videos')
      .select('chapters')
      .eq('id', input.videoId)
      .maybeSingle();

    if (normalizeVideoChapters(video?.chapters).length > 0) {
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

    await generateVideoChapters({
      client: input.client,
      videoId: input.videoId,
      accountId: input.accountId,
      force: false,
    });
  } catch (err) {
    console.error('[videos] auto chapter generate failed', {
      videoId: input.videoId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
