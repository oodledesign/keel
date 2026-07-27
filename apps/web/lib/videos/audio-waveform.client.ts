/**
 * Client-side audio peak extraction for the video editor timeline waveform.
 */

export function computePeaks(
  channelData: Float32Array,
  barCount: number,
): number[] {
  const bars = Math.max(1, Math.floor(barCount));
  if (channelData.length === 0) {
    return Array.from({ length: bars }, () => 0);
  }

  const samplesPerBar = Math.max(1, Math.floor(channelData.length / bars));
  const peaks = new Array<number>(bars).fill(0);

  for (let i = 0; i < bars; i++) {
    const start = i * samplesPerBar;
    const end =
      i === bars - 1
        ? channelData.length
        : Math.min(channelData.length, start + samplesPerBar);
    let max = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(channelData[j] ?? 0);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }

  const peak = Math.max(...peaks, 0.0001);
  return peaks.map((p) => Math.min(1, p / peak));
}

export type WaveformLoadResult =
  | { ok: true; peaks: number[]; durationMs: number; hasSignal: boolean }
  | { ok: false; error: string };

/**
 * Fetch + decode master media and return normalized peaks (0–1).
 * Requires CORS on the media URL (Supabase signed URLs normally allow this).
 */
export async function loadWaveformPeaks(
  mediaUrl: string,
  barCount = 640,
  signal?: AbortSignal,
): Promise<WaveformLoadResult> {
  try {
    const res = await fetch(mediaUrl, { signal, mode: 'cors' });
    if (!res.ok) {
      return { ok: false, error: `Could not fetch audio (${res.status})` };
    }

    const buffer = await res.arrayBuffer();
    if (signal?.aborted) {
      return { ok: false, error: 'Aborted' };
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    try {
      const audio = await ctx.decodeAudioData(buffer.slice(0));
      const channel = audio.getChannelData(0);
      const peaks = computePeaks(channel, barCount);
      const hasSignal = peaks.some((p) => p > 0.02);
      return {
        ok: true,
        peaks,
        durationMs: Math.round(audio.duration * 1000),
        hasSignal,
      };
    } finally {
      await ctx.close().catch(() => undefined);
    }
  } catch (err) {
    if (signal?.aborted) return { ok: false, error: 'Aborted' };
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Waveform decode failed',
    };
  }
}
