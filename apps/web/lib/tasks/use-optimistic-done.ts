'use client';

import { useState } from 'react';

/** Instant check/strike before the server status catches up. */
export function useOptimisticDone(completed: boolean) {
  const [optimistic, setOptimisticDone] = useState<boolean | null>(null);
  const [seenCompleted, setSeenCompleted] = useState(completed);

  if (completed !== seenCompleted) {
    setSeenCompleted(completed);
    setOptimisticDone(null);
  }

  return {
    isDone: optimistic ?? completed,
    setOptimisticDone,
  };
}
