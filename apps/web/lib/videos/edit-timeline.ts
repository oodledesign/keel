/** Non-destructive screen-recording edit timeline (web editor). */

export type VideoKeepRange = {
  startMs: number;
  endMs: number;
};

export type VideoClickEvent = {
  tMs: number;
  /** Normalized 0–1 within the capture frame. */
  x: number;
  y: number;
};

export type VideoZoomKeyframe = {
  id: string;
  startMs: number;
  endMs: number;
  scale: number;
  cx: number;
  cy: number;
  easeInMs: number;
  easeOutMs: number;
};

export type VideoClickStyle = {
  enabled: boolean;
  color: string;
  radiusPx: number;
  fadeMs: number;
};

export type VideoEditTimeline = {
  version: 1;
  sourceDurationMs: number;
  keepRanges: VideoKeepRange[];
  clicks: VideoClickEvent[];
  zooms: VideoZoomKeyframe[];
  clickStyle: VideoClickStyle;
};

export type VideoTranscriptWord = {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number | null;
};

export const DEFAULT_CLICK_STYLE: VideoClickStyle = {
  enabled: true,
  color: '#F5C518',
  radiusPx: 28,
  fadeMs: 500,
};

export function createDefaultTimeline(
  sourceDurationMs: number,
  clicks: VideoClickEvent[] = [],
): VideoEditTimeline {
  const duration = Math.max(0, Math.round(sourceDurationMs));
  return {
    version: 1,
    sourceDurationMs: duration,
    keepRanges: duration > 0 ? [{ startMs: 0, endMs: duration }] : [],
    clicks,
    zooms: [],
    clickStyle: { ...DEFAULT_CLICK_STYLE },
  };
}

export function normalizeTimeline(
  raw: unknown,
  fallbackDurationMs = 0,
): VideoEditTimeline {
  const base = createDefaultTimeline(fallbackDurationMs);
  if (!raw || typeof raw !== 'object') return base;

  const obj = raw as Partial<VideoEditTimeline>;
  const duration = Math.max(
    0,
    Math.round(obj.sourceDurationMs ?? fallbackDurationMs),
  );
  const keepRanges = Array.isArray(obj.keepRanges)
    ? obj.keepRanges
        .map((r) => ({
          startMs: Math.max(0, Math.round(Number(r.startMs) || 0)),
          endMs: Math.max(0, Math.round(Number(r.endMs) || 0)),
        }))
        .filter((r) => r.endMs > r.startMs)
        .sort((a, b) => a.startMs - b.startMs)
    : base.keepRanges;

  const clicks = Array.isArray(obj.clicks)
    ? obj.clicks
        .map((c) => ({
          tMs: Math.max(0, Math.round(Number(c.tMs) || 0)),
          x: clamp01(Number(c.x) || 0),
          y: clamp01(Number(c.y) || 0),
        }))
        .sort((a, b) => a.tMs - b.tMs)
    : [];

  const zooms = Array.isArray(obj.zooms)
    ? obj.zooms
        .map((z) => ({
          id: String(z.id || cryptoRandomId()),
          startMs: Math.max(0, Math.round(Number(z.startMs) || 0)),
          endMs: Math.max(0, Math.round(Number(z.endMs) || 0)),
          scale: Math.min(4, Math.max(1, Number(z.scale) || 1.5)),
          cx: clamp01(Number(z.cx) || 0.5),
          cy: clamp01(Number(z.cy) || 0.5),
          easeInMs: Math.max(0, Math.round(Number(z.easeInMs) || 250)),
          easeOutMs: Math.max(0, Math.round(Number(z.easeOutMs) || 250)),
        }))
        .filter((z) => z.endMs > z.startMs)
        .sort((a, b) => a.startMs - b.startMs)
    : [];

  return {
    version: 1,
    sourceDurationMs: duration,
    keepRanges:
      keepRanges.length > 0
        ? keepRanges
        : duration > 0
          ? [{ startMs: 0, endMs: duration }]
          : [],
    clicks,
    zooms,
    clickStyle: {
      ...DEFAULT_CLICK_STYLE,
      ...(obj.clickStyle ?? {}),
      color: obj.clickStyle?.color || DEFAULT_CLICK_STYLE.color,
    },
  };
}

export function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `z_${Math.random().toString(36).slice(2, 10)}`;
}

/** Remove [fromMs, toMs) from keepRanges (Loom-style delete selection). */
export function removeRangeFromKeep(
  keepRanges: VideoKeepRange[],
  fromMs: number,
  toMs: number,
): VideoKeepRange[] {
  const from = Math.min(fromMs, toMs);
  const to = Math.max(fromMs, toMs);
  if (to <= from) return keepRanges;

  const next: VideoKeepRange[] = [];
  for (const range of keepRanges) {
    if (range.endMs <= from || range.startMs >= to) {
      next.push(range);
      continue;
    }
    if (range.startMs < from) {
      next.push({ startMs: range.startMs, endMs: from });
    }
    if (range.endMs > to) {
      next.push({ startMs: to, endMs: range.endMs });
    }
  }
  return next.filter((r) => r.endMs - r.startMs >= 40);
}

/** Map source time → edited timeline time (after cuts). */
export function sourceMsToEditedMs(
  keepRanges: VideoKeepRange[],
  sourceMs: number,
): number | null {
  let edited = 0;
  for (const range of keepRanges) {
    if (sourceMs < range.startMs) return null;
    if (sourceMs <= range.endMs) {
      return edited + (sourceMs - range.startMs);
    }
    edited += range.endMs - range.startMs;
  }
  return null;
}

export function editedDurationMs(keepRanges: VideoKeepRange[]) {
  return keepRanges.reduce((sum, r) => sum + (r.endMs - r.startMs), 0);
}

export function isTimeKept(keepRanges: VideoKeepRange[], sourceMs: number) {
  return keepRanges.some((r) => sourceMs >= r.startMs && sourceMs < r.endMs);
}

/** Active zoom at a source timestamp, with interpolated scale. */
export function zoomAtTime(
  zooms: VideoZoomKeyframe[],
  sourceMs: number,
): { scale: number; cx: number; cy: number } | null {
  const zoom = zooms.find((z) => sourceMs >= z.startMs && sourceMs < z.endMs);
  if (!zoom) return null;

  const t = sourceMs - zoom.startMs;
  const dur = Math.max(1, zoom.endMs - zoom.startMs);
  const easeIn = Math.min(zoom.easeInMs, dur / 2);
  const easeOut = Math.min(zoom.easeOutMs, dur / 2);

  let factor = 1;
  if (t < easeIn && easeIn > 0) {
    factor = t / easeIn;
  } else if (t > dur - easeOut && easeOut > 0) {
    factor = (dur - t) / easeOut;
  }

  const scale = 1 + (zoom.scale - 1) * smoothstep(factor);
  return { scale, cx: zoom.cx, cy: zoom.cy };
}

function smoothstep(x: number) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

export function suggestZoomsFromClicks(
  clicks: VideoClickEvent[],
  sourceDurationMs: number,
  keepRanges: VideoKeepRange[],
): VideoZoomKeyframe[] {
  if (clicks.length === 0 || sourceDurationMs <= 0) return [];

  const clusterGapMs = 800;
  const holdMs = 1800;
  const clusters: VideoClickEvent[][] = [];
  let current: VideoClickEvent[] = [];

  for (const click of clicks) {
    if (!isTimeKept(keepRanges, click.tMs)) continue;
    if (current.length === 0) {
      current = [click];
      continue;
    }
    const last = current[current.length - 1]!;
    if (click.tMs - last.tMs <= clusterGapMs) {
      current.push(click);
    } else {
      clusters.push(current);
      current = [click];
    }
  }
  if (current.length) clusters.push(current);

  const zooms: VideoZoomKeyframe[] = [];
  for (const cluster of clusters) {
    const cx =
      cluster.reduce((s, c) => s + c.x, 0) / Math.max(1, cluster.length);
    const cy =
      cluster.reduce((s, c) => s + c.y, 0) / Math.max(1, cluster.length);
    const mid = cluster[Math.floor(cluster.length / 2)]!.tMs;
    const startMs = Math.max(0, mid - 350);
    const endMs = Math.min(sourceDurationMs, mid + holdMs);
    if (endMs - startMs < 600) continue;

    // Skip if overlaps an existing suggestion heavily
    if (
      zooms.some((z) => !(endMs <= z.startMs + 200 || startMs >= z.endMs - 200))
    ) {
      continue;
    }

    zooms.push({
      id: cryptoRandomId(),
      startMs,
      endMs,
      scale: 1.65,
      cx: clamp01(cx),
      cy: clamp01(cy),
      easeInMs: 280,
      easeOutMs: 320,
    });
  }

  return zooms;
}

/** Build ffmpeg filter args for cuts + optional zoompan (server/client export). */
export function buildFfmpegCutArgs(timeline: VideoEditTimeline): string[] {
  const ranges = timeline.keepRanges;
  if (ranges.length === 0) {
    return [
      '-f',
      'lavfi',
      '-i',
      'color=c=black:s=1280x720:d=1',
      '-c:v',
      'libx264',
    ];
  }

  if (ranges.length === 1) {
    const r = ranges[0]!;
    const args = [
      '-ss',
      (r.startMs / 1000).toFixed(3),
      '-to',
      (r.endMs / 1000).toFixed(3),
      '-i',
      'input.mp4',
      '-c',
      'copy',
      'output.mp4',
    ];
    return args;
  }

  // Multi-segment: re-encode with filter_complex concat
  const parts: string[] = ['-i', 'input.mp4', '-filter_complex'];
  const filters: string[] = [];
  const concatInputs: string[] = [];
  ranges.forEach((r, i) => {
    filters.push(
      `[0:v]trim=start=${(r.startMs / 1000).toFixed(3)}:end=${(r.endMs / 1000).toFixed(3)},setpts=PTS-STARTPTS[v${i}]`,
    );
    filters.push(
      `[0:a]atrim=start=${(r.startMs / 1000).toFixed(3)}:end=${(r.endMs / 1000).toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`,
    );
    concatInputs.push(`[v${i}][a${i}]`);
  });
  filters.push(
    `${concatInputs.join('')}concat=n=${ranges.length}:v=1:a=1[outv][outa]`,
  );
  parts.push(filters.join(';'));
  parts.push(
    '-map',
    '[outv]',
    '-map',
    '[outa]',
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    'output.mp4',
  );
  return parts;
}
