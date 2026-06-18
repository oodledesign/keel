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

  const runFallbackPoll = useCallback(async () => {
    setUsingFallback(true);
    let active = true;

    const poll = async () => {
      try {
        const next = await fallbackFetchRef.current();
        if (!active) return;
        setData(next);
        if (!isTerminal(next)) {
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
  }, [isTerminal, pollIntervalMs]);

  useEffect(() => {
    if (!streamUrl) {
      return;
    }

    let active = true;
    let source: EventSource | null = null;
    let cleanupFallback: (() => void) | undefined;

    const startFallback = () => {
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
          const payload = JSON.parse(event.data) as T;
          setData(payload);
        } catch {
          // ignore malformed events
        }
      };

      source.onerror = () => {
        if (!active) return;
        source?.close();
        source = null;
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
