'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

type UseRanklyJobProgressOptions<T> = {
  streamUrl: string;
  fallbackFetch: () => Promise<T>;
  isTerminal: (data: T) => boolean;
  pollIntervalMs?: number;
};

export function useRanklyJobProgress<T extends { status: string }>({
  streamUrl,
  fallbackFetch,
  isTerminal,
  pollIntervalMs = 3000,
}: UseRanklyJobProgressOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const fallbackFetchRef = useRef(fallbackFetch);
  fallbackFetchRef.current = fallbackFetch;
  const isTerminalRef = useRef(isTerminal);
  isTerminalRef.current = isTerminal;

  const runFallbackPoll = useCallback(async () => {
    setUsingFallback(true);
    let active = true;

    const poll = async () => {
      try {
        const next = await fallbackFetchRef.current();
        if (!active) return;
        setData(next);
        if (!isTerminalRef.current(next)) {
          setTimeout(poll, pollIntervalMs);
        }
      } catch (err) {
        if (active) toast.error(getErrorMessage(err));
      }
    };

    void poll();
    return () => {
      active = false;
    };
  }, [pollIntervalMs]);

  useEffect(() => {
    if (!streamUrl) {
      return;
    }

    let active = true;
    let source: EventSource | null = null;
    let cleanupFallback: (() => void) | undefined;
    let fallbackStarted = false;

    const startFallback = () => {
      if (fallbackStarted || !active) return;
      fallbackStarted = true;
      source?.close();
      source = null;
      void runFallbackPoll().then((cleanup) => {
        if (!active) cleanup?.();
        else cleanupFallback = cleanup;
      });
    };

    try {
      source = new EventSource(streamUrl);

      source.onmessage = (event) => {
        if (!active) return;
        try {
          const payload = JSON.parse(event.data) as T & {
            stream_end?: boolean;
            done?: boolean;
          };
          setData(payload);

          if (payload.stream_end && !isTerminalRef.current(payload)) {
            startFallback();
            return;
          }

          if (isTerminalRef.current(payload) || payload.done) {
            source?.close();
            source = null;
          }
        } catch {
          // ignore malformed events
        }
      };

      source.onerror = () => {
        if (!active) return;
        startFallback();
      };
    } catch {
      startFallback();
    }

    return () => {
      active = false;
      source?.close();
      cleanupFallback?.();
    };
  }, [runFallbackPoll, streamUrl]);

  return { data, usingFallback };
}
