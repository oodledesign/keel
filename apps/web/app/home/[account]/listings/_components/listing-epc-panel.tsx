'use client';

import { useState } from 'react';

import { Leaf, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import type {
  ListingEpcAttachment,
  ListingEpcLookup,
  ListingEpcSearchResult,
  RankedListingEpcHit,
} from '~/lib/commercial/listing-epc';
import { workspaceTextMuted } from '~/lib/workspace-ui';

import {
  attachListingEpcAction,
  refreshListingEpcAction,
  searchListingEpcAction,
} from '../_lib/server/listing-epc-actions';

function formatFetchedAt(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatListingEpcValue(input: {
  epcBand: string | null;
  epcRating: number | null;
}) {
  if (input.epcBand) {
    return input.epcRating != null
      ? `${input.epcBand} (${input.epcRating})`
      : input.epcBand;
  }
  if (input.epcRating != null) return String(input.epcRating);
  return null;
}

export function ListingEpcPanel({
  accountId,
  listingId,
  canEdit,
  configured,
  lookup,
  attached: initialAttached,
  compact = false,
  onAttached,
}: {
  accountId: string;
  listingId: string;
  canEdit: boolean;
  configured: boolean;
  lookup: ListingEpcLookup;
  attached: ListingEpcAttachment;
  compact?: boolean;
  onAttached?: (next: ListingEpcAttachment) => void;
}) {
  const [attached, setAttached] = useState(initialAttached);
  const [hits, setHits] = useState<RankedListingEpcHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);

  const syncAttached = (next: ListingEpcAttachment) => {
    setAttached(next);
    onAttached?.(next);
  };

  const applySearch = (result: ListingEpcSearchResult) => {
    setHits(result.hits);
    if (result.hits.length === 0) {
      toast.error('No energy certificates matched this address.');
    }
  };

  const handleSearch = async () => {
    if (!canEdit || !configured) return;
    setSearching(true);
    try {
      const result = await searchListingEpcAction({
        accountId,
        listingId,
        address: lookup.address,
        postcode: lookup.postcode,
        uprn: lookup.uprn,
      });
      if (!result.configured) {
        toast.error('EPC lookup is unavailable.');
        return;
      }
      if (
        result.highConfidenceCertificateNumber &&
        !attached.certificateNumber &&
        !attached.epcBand &&
        attached.epcRating == null
      ) {
        await handleAttach(result.highConfidenceCertificateNumber);
        return;
      }
      applySearch(result);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSearching(false);
    }
  };

  const handleAttach = async (certificateNumber: string) => {
    if (!canEdit) return;
    setAttaching(certificateNumber);
    try {
      const next = await attachListingEpcAction({
        accountId,
        listingId,
        certificateNumber,
      });
      syncAttached(next);
      setHits([]);
      toast.success('EPC attached from the GOV.UK register.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAttaching(null);
    }
  };

  const handleRefresh = async () => {
    if (!canEdit || !configured) return;
    if (!attached.certificateNumber) {
      await handleSearch();
      return;
    }
    setRefreshing(true);
    try {
      const next = await refreshListingEpcAction({
        accountId,
        listingId,
      });
      syncAttached(next);
      toast.success('EPC refreshed. Your edits were kept.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  };

  const display = formatListingEpcValue(attached);
  const fetchedLabel = formatFetchedAt(attached.fetchedAt);
  const hasLookup = Boolean(lookup.postcode || lookup.address || lookup.uprn);

  return (
    <div className="space-y-3" data-test="listing-epc-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          {compact ? null : (
            <h4 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Energy Performance Certificate
            </h4>
          )}
          <p
            className={`${compact ? '' : 'mt-1'} text-xs ${workspaceTextMuted}`}
          >
            {configured
              ? 'Fetch the matching certificate from the GOV.UK register. Non-domestic results are preferred.'
              : 'EPC lookup is not configured on this environment.'}
          </p>
        </div>
        {compact ? null : (
          <Leaf className={`h-4 w-4 shrink-0 ${workspaceTextMuted}`} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--workspace-shell-text)]">
          {display ?? 'No EPC recorded'}
          {attached.certificateNumber ? (
            <span className={`mt-0.5 block text-xs ${workspaceTextMuted}`}>
              Certificate {attached.certificateNumber}
              {fetchedLabel ? ` · pulled ${fetchedLabel}` : ''}
            </span>
          ) : null}
        </p>
        {canEdit && configured ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={searching || refreshing || !hasLookup}
            onClick={() =>
              void (attached.certificateNumber
                ? handleRefresh()
                : handleSearch())
            }
            data-test="listing-epc-fetch"
          >
            {refreshing || searching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {attached.certificateNumber ? 'Refresh EPC' : 'Fetch EPC'}
          </Button>
        ) : null}
      </div>

      {!hasLookup ? (
        <p className={`text-xs ${workspaceTextMuted}`}>
          Add a postcode or address before fetching an EPC.
        </p>
      ) : null}

      {hits.length > 0 ? (
        <ul className="space-y-2">
          {hits.map((hit) => (
            <li
              key={hit.certificateNumber}
              className="flex flex-col gap-2 rounded-xl border border-[color:var(--workspace-shell-border)] p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  {hit.addressLabel || hit.certificateNumber}
                </p>
                <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>
                  {hit.certificateNumber}
                  {hit.currentEnergyEfficiencyBand
                    ? ` · band ${hit.currentEnergyEfficiencyBand}`
                    : ''}
                  {hit.registrationDate ? ` · ${hit.registrationDate}` : ''}
                  {hit.register === 'domestic' ? ' · domestic' : ''}
                </p>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={attaching === hit.certificateNumber}
                  onClick={() => void handleAttach(hit.certificateNumber)}
                  data-test={`listing-epc-use-${hit.certificateNumber}`}
                >
                  {attaching === hit.certificateNumber ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Use this certificate
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
