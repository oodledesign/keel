import {
  type VideoKeepRange,
  type VideoTranscriptWord,
  sourceMsToEditedMsClamped,
} from './edit-timeline';

export type TranscriptSegment = {
  startMs: number;
  endMs: number;
  text: string;
};

const MIN_SEGMENT_MS = 8000;
const MAX_SEGMENT_MS = 25000;
const PAUSE_BREAK_MS = 2000;

/**
 * Groups word-timed transcript words into readable paragraphs in playback
 * time. With keepRanges, words in deleted sections are dropped and times are
 * mapped onto the edited timeline; pass null when playback is the original
 * recording.
 */
export function buildTranscriptSegments(
  words: VideoTranscriptWord[],
  keepRanges: VideoKeepRange[] | null,
): TranscriptSegment[] {
  const edited = Boolean(keepRanges && keepRanges.length > 0);
  const segments: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;

  const sorted = [...words]
    .filter((w) => w.text.trim() && w.endMs >= w.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  for (const word of sorted) {
    let startMs = word.startMs;
    let endMs = Math.max(word.endMs, word.startMs + 1);

    if (edited && keepRanges) {
      const mid = (startMs + endMs) / 2;
      if (!keepRanges.some((r) => mid >= r.startMs && mid < r.endMs)) continue;
      startMs = sourceMsToEditedMsClamped(keepRanges, startMs);
      endMs = Math.max(
        startMs + 1,
        sourceMsToEditedMsClamped(keepRanges, endMs),
      );
    }

    const text = word.text.trim();
    const duration = current ? endMs - current.startMs : 0;
    const startsNew =
      !current ||
      startMs - current.endMs > PAUSE_BREAK_MS ||
      duration > MAX_SEGMENT_MS ||
      (duration > MIN_SEGMENT_MS && /[.?!]$/.test(current.text));

    if (startsNew || !current) {
      current = { startMs, endMs, text };
      segments.push(current);
    } else {
      current.text = `${current.text} ${text}`;
      current.endMs = Math.max(current.endMs, endMs);
    }
  }

  return segments;
}

/** Index of the segment playing at `ms`, holding the previous one through gaps. */
export function activeSegmentIndex(
  segments: TranscriptSegment[],
  ms: number,
): number {
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid]!.startMs <= ms) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
