import {
  type VideoKeepRange,
  type VideoTranscriptWord,
  sourceMsToEditedMsClamped,
} from './edit-timeline';

export type CaptionCue = {
  startMs: number;
  endMs: number;
  text: string;
};

const MAX_CUE_CHARS = 42;
const MAX_CUE_MS = 5000;
const PAUSE_BREAK_MS = 700;
const MIN_CUE_MS = 900;

/**
 * Desktop (Apple Speech) transcripts only carry evenly spread estimated
 * timings, so captions built from them drift away from the speech.
 */
export function transcriptHasRealTimings(
  provider: string | null | undefined,
  words: VideoTranscriptWord[],
): boolean {
  return provider !== 'desktop-speech' && words.length > 0;
}

function keptRangeIndex(keepRanges: VideoKeepRange[], ms: number): number {
  return keepRanges.findIndex((r) => ms >= r.startMs && ms < r.endMs);
}

/**
 * Groups word-timed transcript words into short caption cues, in source
 * (original recording) time. When keepRanges are given, words in deleted
 * sections are dropped and no cue spans a cut.
 */
export function buildCaptionCues(
  words: VideoTranscriptWord[],
  keepRanges: VideoKeepRange[] | null,
): CaptionCue[] {
  const limitToKept = Boolean(keepRanges && keepRanges.length > 0);
  const sorted = [...words]
    .filter((w) => w.text.trim() && w.endMs >= w.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  type Draft = CaptionCue & { rangeIndex: number; limitMs: number };
  const drafts: Draft[] = [];
  let current: Draft | null = null;

  for (const word of sorted) {
    const text = word.text.trim();
    let startMs = word.startMs;
    let endMs = Math.max(word.endMs, word.startMs + 1);
    let rangeIndex = -1;
    let limitMs = Number.POSITIVE_INFINITY;

    if (limitToKept && keepRanges) {
      rangeIndex = keptRangeIndex(keepRanges, (startMs + endMs) / 2);
      if (rangeIndex === -1) continue;
      const range = keepRanges[rangeIndex]!;
      startMs = Math.max(startMs, range.startMs);
      endMs = Math.min(endMs, range.endMs);
      limitMs = range.endMs;
    }

    const startsNewCue =
      !current ||
      current.rangeIndex !== rangeIndex ||
      startMs - current.endMs > PAUSE_BREAK_MS ||
      current.text.length + 1 + text.length > MAX_CUE_CHARS ||
      endMs - current.startMs > MAX_CUE_MS ||
      /[.?!]$/.test(current.text);

    if (startsNewCue || !current) {
      current = { startMs, endMs, text, rangeIndex, limitMs };
      drafts.push(current);
    } else {
      current.text = `${current.text} ${text}`;
      current.endMs = Math.max(current.endMs, endMs);
    }
  }

  return drafts.map((cue, i) => {
    const next = drafts[i + 1];
    const ceiling = Math.min(
      cue.limitMs,
      next ? next.startMs : Number.POSITIVE_INFINITY,
    );
    const endMs = Math.max(
      cue.endMs,
      Math.min(cue.startMs + MIN_CUE_MS, ceiling),
    );
    return { startMs: cue.startMs, endMs, text: cue.text };
  });
}

/** Re-times source-time cues onto the edited (trimmed) timeline. */
export function cuesToEditedTime(
  cues: CaptionCue[],
  keepRanges: VideoKeepRange[],
): CaptionCue[] {
  return cues
    .map((cue) => ({
      text: cue.text,
      startMs: sourceMsToEditedMsClamped(keepRanges, cue.startMs),
      endMs: sourceMsToEditedMsClamped(keepRanges, cue.endMs),
    }))
    .filter((cue) => cue.endMs > cue.startMs);
}

function srtTimestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

export function cuesToSrt(cues: CaptionCue[]): string {
  return cues
    .map(
      (cue, i) =>
        `${i + 1}\n${srtTimestamp(cue.startMs)} --> ${srtTimestamp(cue.endMs)}\n${cue.text}\n`,
    )
    .join('\n');
}

export function captionCueAt(
  cues: CaptionCue[],
  ms: number,
): CaptionCue | null {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cue = cues[mid]!;
    if (ms < cue.startMs) hi = mid - 1;
    else if (ms >= cue.endMs) lo = mid + 1;
    else return cue;
  }
  return null;
}
