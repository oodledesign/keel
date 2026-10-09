'use client';

import { useEffect, useMemo, useState } from 'react';

import { searchAudiencePeopleAction } from '../_lib/server/server-actions';
import type { AudiencePickerOption } from './campaign-audience-picker';

const DEBOUNCE_MS = 250;

export function matchesAudiencePerson(row: AudiencePickerOption, q: string) {
  return (
    row.email.toLowerCase().includes(q) ||
    row.displayName.toLowerCase().includes(q)
  );
}

/**
 * People matching `query`. Pages only send a short starting list, so this
 * asks the database; people already loaded (e.g. just created) show at once.
 * Without an account id it only filters `loaded`.
 */
export function useAudiencePeopleSearch(input: {
  accountId?: string;
  kind: 'clients' | 'contacts';
  query: string;
  loaded: AudiencePickerOption[];
}): { results: AudiencePickerOption[]; searching: boolean } {
  const { accountId, kind, loaded } = input;
  const q = input.query.trim().toLowerCase();
  const key = `${kind}:${q}`;
  const [found, setFound] = useState<{
    key: string;
    rows: AudiencePickerOption[];
  } | null>(null);

  useEffect(() => {
    if (!accountId || !q) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchAudiencePeopleAction({ accountId, kind, query: q })
        .then((rows) => {
          if (!cancelled) setFound({ key: `${kind}:${q}`, rows });
        })
        .catch(() => {
          if (!cancelled) setFound({ key: `${kind}:${q}`, rows: [] });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accountId, kind, q]);

  const local = useMemo(
    () => (q ? loaded.filter((row) => matchesAudiencePerson(row, q)) : []),
    [loaded, q],
  );

  if (!q) return { results: [], searching: false };
  if (!accountId) return { results: local, searching: false };
  if (found?.key !== key) return { results: local, searching: true };

  const seen = new Set(found.rows.map((row) => row.id));
  return {
    results: [...found.rows, ...local.filter((row) => !seen.has(row.id))],
    searching: false,
  };
}
