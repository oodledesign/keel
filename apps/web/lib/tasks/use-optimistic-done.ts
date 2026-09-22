'use client';

import { useState } from 'react';

import { commitOptimisticUpdate } from '~/lib/tasks/commit-optimistic-update';

/** Instant check/strike before the server status catches up. */
export function useOptimisticDone(completed: boolean) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [seenCompleted, setSeenCompleted] = useState(completed);

  if (completed !== seenCompleted) {
    setSeenCompleted(completed);
    setOptimistic(null);
  }

  return {
    isDone: optimistic ?? completed,
    setOptimisticDone: (next: boolean) => {
      commitOptimisticUpdate(() => {
        setOptimistic(next);
      });
    },
  };
}
