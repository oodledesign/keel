'use client';

import { useEffect, useRef, useState } from 'react';

import { estimateSecondsLeft } from '~/lib/videos/eta';

export type EncodeProgress = {
  percent: number;
  secondsLeft: number | null;
};

type StatusResponse =
  | {
      ok: true;
      data: { status: string; encodeProgress?: number };
    }
  | { ok: false; error: { message: string } };

/**
 * Polls the status route for videos that are still encoding and derives a
 * progress percentage and time-left estimate from successive samples.
 * `onSettled` fires once a video becomes ready or failed.
 */
export function useEncodeProgress(
  videoIds: string[],
  onSettled: (videoId: string, status: 'ready' | 'failed') => void,
  intervalMs = 5000,
) {
  const [progress, setProgress] = useState<Record<string, EncodeProgress>>({});
  const firstSample = useRef(
    new Map<string, { at: number; fraction: number }>(),
  );
  const settled = useRef(onSettled);
  settled.current = onSettled;

  const key = videoIds.join(',');

  useEffect(() => {
    if (videoIds.length === 0) return;
    let cancelled = false;

    const poll = async () => {
      await Promise.all(
        videoIds.map(async (videoId) => {
          try {
            const res = await fetch(`/api/videos/${videoId}/status`);
            const json = (await res.json()) as StatusResponse;
            if (!json.ok || cancelled) return;

            const { status, encodeProgress } = json.data;
            if (status === 'ready' || status === 'failed') {
              settled.current(videoId, status);
              return;
            }

            const percent = Math.max(0, Math.min(100, encodeProgress ?? 0));
            const now = Date.now();
            const fraction = percent / 100;
            let first = firstSample.current.get(videoId);
            if (!first || fraction < first.fraction) {
              first = { at: now, fraction };
              firstSample.current.set(videoId, first);
            }

            setProgress((current) => ({
              ...current,
              [videoId]: {
                percent,
                secondsLeft: estimateSecondsLeft({
                  fraction,
                  startFraction: first.fraction,
                  elapsedMs: now - first.at,
                }),
              },
            }));
          } catch {
            // Transient network errors: keep polling.
          }
        }),
      );
    };

    void poll();
    const timer = window.setInterval(() => void poll(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // `key` captures the id list by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs]);

  return progress;
}
