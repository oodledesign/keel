'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2 } from 'lucide-react';

import pathsConfig from '~/config/paths.config';

import { createListing } from '../../_lib/server/server-actions';

type Props = {
  accountId: string;
  accountSlug: string;
  name?: string;
  notes?: string;
  askingRent?: string;
  clientId?: string;
  dealId?: string;
  sopAssist?: string;
};

type CreatedListing = { id: string };

/** Survives React Strict Mode remounts so we only insert one draft per visit.
 * Relies on the server action resolving after Strict Mode's synchronous cleanup.
 * Keep this module-scoped (not a ref) so it survives the unmount/remount cycle. */
let inflightCreate: Promise<CreatedListing> | null = null;
let inflightKey: string | null = null;

function buildCreateKey(props: Props) {
  return [
    props.accountId,
    props.name?.trim() ?? '',
    props.notes?.trim() ?? '',
    props.askingRent?.trim() ?? '',
    props.clientId?.trim() ?? '',
    props.dealId?.trim() ?? '',
    props.sopAssist?.trim() ?? '',
  ].join('|');
}

/**
 * Creates a draft disposal once on the client, then redirects to edit.
 * Must not create on GET/RSC — Next link prefetch was spawning untitled drafts.
 */
export function CreateDisposalOnce(props: Props) {
  const {
    accountId,
    accountSlug,
    name,
    notes,
    askingRent,
    clientId,
    dealId,
    sopAssist,
  } = props;
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const key = `${buildCreateKey(props)}#${retryToken}`;

    void (async () => {
      try {
        if (!inflightCreate || inflightKey !== key) {
          inflightKey = key;
          inflightCreate = (async () => {
            const askingRentPence = askingRent?.trim()
              ? Math.round(parseFloat(askingRent) * 100)
              : null;

            const listing = await createListing({
              accountId,
              name: name?.trim() || 'Untitled disposal',
              status: 'draft',
              notes: notes?.trim() || null,
              askingRentPence:
                askingRentPence != null && Number.isFinite(askingRentPence)
                  ? askingRentPence
                  : null,
              instructingClientId: clientId?.trim() || null,
            });

            return { id: listing.id };
          })();
        }

        const listing = await inflightCreate;

        if (cancelled) return;

        inflightCreate = null;
        inflightKey = null;

        const editPath = pathsConfig.app.accountListingEdit
          .replace('[account]', accountSlug)
          .replace('[id]', listing.id);

        const qs = new URLSearchParams();
        if (dealId?.trim()) qs.set('dealId', dealId.trim());
        if (sopAssist?.trim()) qs.set('sopAssist', sopAssist.trim());

        router.replace(`${editPath}${qs.size ? `?${qs.toString()}` : ''}`);
      } catch (err) {
        if (cancelled) return;
        inflightCreate = null;
        inflightKey = null;
        setError(
          err instanceof Error ? err.message : 'Could not create disposal',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create once per visit/retry
  }, [retryToken]);

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Couldn’t create disposal
        </p>
        <p className="max-w-sm text-sm text-[var(--workspace-shell-text-muted)]">
          {error}
        </p>
        <button
          type="button"
          className="text-sm font-medium text-[var(--ozer-accent)] hover:underline"
          onClick={() => {
            setError(null);
            setRetryToken((n) => n + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-[var(--workspace-shell-text-muted)]">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--ozer-accent)]" />
      <p className="text-sm">Creating draft disposal…</p>
    </div>
  );
}
