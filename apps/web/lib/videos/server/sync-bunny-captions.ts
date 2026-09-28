import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createBunnyStreamClient } from '@kit/bunny';

import {
  buildCaptionCues,
  cuesToEditedTime,
  cuesToSrt,
  transcriptHasRealTimings,
} from '../captions';
import {
  type VideoKeepRange,
  type VideoTranscriptWord,
  normalizeTimeline,
} from '../edit-timeline';
import { resolveEffectivePlayerConfig } from './player-config-data';
import { resolveAccountBunnyApiKey } from './videos-data';

export type BunnyCaptionSyncFailure =
  | 'no_transcript'
  | 'estimated_timings'
  | 'no_cues'
  | 'bake_pending';

export type BunnyCaptionSyncResult =
  | { ok: true; cueCount: number; srclang: string }
  | { ok: false; reason: BunnyCaptionSyncFailure };

type VideoForCaptionTiming = {
  baked_revision?: number | null;
  published_revision?: number | null;
  published_timeline?: unknown;
};

/**
 * Which timeline the current Bunny asset follows. Unbaked videos still hold the
 * original upload (source time); baked ones hold the published edit.
 */
export function bunnyCaptionKeepRanges(
  video: VideoForCaptionTiming,
): { ok: true; keepRanges: VideoKeepRange[] | null } | { ok: false } {
  const baked = Number(video.baked_revision ?? 0);
  if (baked <= 0) return { ok: true, keepRanges: null };
  if (
    !video.published_timeline ||
    baked !== Number(video.published_revision ?? 0)
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    keepRanges: normalizeTimeline(video.published_timeline).keepRanges,
  };
}

function captionLabel(srclang: string): string {
  try {
    return (
      new Intl.DisplayNames(['en'], { type: 'language' }).of(srclang) ??
      srclang.toUpperCase()
    );
  } catch {
    return srclang.toUpperCase();
  }
}

/** Builds captions from the word-timed transcript and uploads them to Bunny. */
export async function syncTranscriptCaptionsToBunny(input: {
  client: SupabaseClient;
  videoId: string;
  accountId: string;
  bunnyLibraryId: string;
  bunnyVideoId: string;
  /** Edited-video keep ranges, or null when Bunny holds the original recording. */
  keepRanges: VideoKeepRange[] | null;
}): Promise<BunnyCaptionSyncResult> {
  const { data: transcript } = await input.client
    .from('video_transcripts')
    .select('words, provider, status')
    .eq('video_id', input.videoId)
    .maybeSingle();

  if (!transcript || transcript.status !== 'ready') {
    return { ok: false, reason: 'no_transcript' };
  }

  const words = (transcript.words ?? []) as VideoTranscriptWord[];
  if (!transcriptHasRealTimings(transcript.provider as string | null, words)) {
    return { ok: false, reason: 'estimated_timings' };
  }

  const sourceCues = buildCaptionCues(words, input.keepRanges);
  const cues = input.keepRanges?.length
    ? cuesToEditedTime(sourceCues, input.keepRanges)
    : sourceCues;
  if (cues.length === 0) return { ok: false, reason: 'no_cues' };

  const { config } = await resolveEffectivePlayerConfig(
    input.client,
    input.accountId,
    input.videoId,
  );
  const srclang = config.default_caption_language?.trim() || 'en';

  const apiKey = await resolveAccountBunnyApiKey(input.client, input.accountId);
  const bunny = createBunnyStreamClient(apiKey);
  await bunny.uploadCaption(input.bunnyLibraryId, input.bunnyVideoId, {
    srclang,
    label: captionLabel(srclang),
    file: new Blob([cuesToSrt(cues)], { type: 'text/plain' }),
  });

  return { ok: true, cueCount: cues.length, srclang };
}
