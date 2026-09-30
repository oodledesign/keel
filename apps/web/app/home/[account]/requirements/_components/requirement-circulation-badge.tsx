'use client';

import { useEffect, useState } from 'react';

import { formatCommsDate } from '~/lib/commercial/circulation/contact-comms';
import type { RequirementCirculationState } from '~/lib/commercial/circulation/contact-comms-summary';

import { CirculationPill } from '../../clients/_components/contact-comms-pills';
import { listRequirementCirculationStates } from '../_lib/server/server-actions';

type States = Record<string, RequirementCirculationState>;

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<States> }>();

/** One request per board: every card on the page shares the same fetch. */
function loadStates(accountId: string): Promise<States> {
  const hit = cache.get(accountId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = listRequirementCirculationStates({ accountId }).catch(
    (error: unknown) => {
      console.error('Failed to load requirement circulation states', error);
      cache.delete(accountId);
      return {} as States;
    },
  );
  cache.set(accountId, { at: Date.now(), promise });
  return promise;
}

export function RequirementCirculationBadge({
  accountId,
  requirementId,
}: {
  accountId: string;
  requirementId: string;
}) {
  const [state, setState] = useState<RequirementCirculationState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadStates(accountId).then((states) => {
      if (!cancelled) setState(states[requirementId] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, requirementId]);

  if (!state) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
      {state.email ? (
        <>
          <CirculationPill status={state.status} focusable={false} />
          <span className="opacity-75">
            {state.lastCirculatedAt
              ? `Last sent ${formatCommsDate(state.lastCirculatedAt)}`
              : 'Never sent'}
          </span>
        </>
      ) : (
        <span className="font-medium text-amber-700 dark:text-amber-300">
          No email address
        </span>
      )}
    </div>
  );
}
