'use client';

import { useState } from 'react';

import { Leaf, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import type {
  EpcSearchHit,
  SurveyEpcRecord,
  SurveyPropertyLookup,
} from '~/lib/building-surveyor/epc/types';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  attachSurveyEpcAction,
  clearSurveyEpcAction,
  saveSurveyPropertyLookupAction,
  searchSurveyEpcAction,
} from '../_lib/server/survey-epc-actions';
import type { SurveyEpcSearchResult } from '../_lib/server/survey-epc.service';

type RankedHit = EpcSearchHit & {
  matchScore: number;
  addressLabel: string;
};

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

function RatingBadge({ rating }: { rating: string | null }) {
  if (!rating) return <span className={workspaceTextMuted}>—</span>;
  return (
    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-[var(--ozer-accent-subtle)] px-2 text-sm font-semibold text-[var(--workspace-shell-accent-text)]">
      {rating}
    </span>
  );
}

export function SurveyEpcPanel({
  accountId,
  accountSlug,
  proposalId,
  canEdit,
  configured,
  lookup: initialLookup,
  attached: initialAttached,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  configured: boolean;
  lookup: SurveyPropertyLookup;
  attached: SurveyEpcRecord | null;
}) {
  const [address, setAddress] = useState(initialLookup.address ?? '');
  const [postcode, setPostcode] = useState(initialLookup.postcode ?? '');
  const [uprn, setUprn] = useState(initialLookup.uprn ?? '');
  const [attached, setAttached] = useState(initialAttached);
  const [hits, setHits] = useState<RankedHit[]>([]);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);

  const applySearch = (result: SurveyEpcSearchResult) => {
    setHits(result.hits);
    if (result.hits.length === 0) {
      toast.error('No energy certificates matched this address.');
      return;
    }
    toast.success(
      result.hits.length === 1
        ? 'One certificate found — confirm it below.'
        : `${result.hits.length} certificates found. Confirm the matching one.`,
    );
  };

  const handleSave = async (suggest: boolean) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const result = await saveSurveyPropertyLookupAction({
        accountId,
        accountSlug,
        proposalId,
        address: address.trim() || null,
        postcode: postcode.trim() || null,
        uprn: uprn.trim() || null,
        suggest,
      });
      setAddress(result.lookup.address ?? '');
      setPostcode(result.lookup.postcode ?? '');
      setUprn(result.lookup.uprn ?? '');
      toast.success('Property lookup saved');
      if (result.suggestions) applySearch(result.suggestions);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleFetch = async () => {
    if (!canEdit) return;
    setSearching(true);
    try {
      const result = await searchSurveyEpcAction({
        accountId,
        accountSlug,
        proposalId,
        address: address.trim() || null,
        postcode: postcode.trim() || null,
        uprn: uprn.trim() || null,
      });
      if (!result.configured) {
        toast.error(
          'EPC lookup is not configured on this server. Ask an admin to add the GOV.UK EPC API token.',
        );
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
      const next = await attachSurveyEpcAction({
        accountId,
        accountSlug,
        proposalId,
        certificateNumber,
      });
      setAttached(next);
      setHits([]);
      if (next.uprn) setUprn(next.uprn);
      toast.success('EPC attached to this survey');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAttaching(null);
    }
  };

  const handleClear = async () => {
    if (!canEdit) return;
    try {
      await clearSurveyEpcAction({
        accountId,
        accountSlug,
        proposalId,
      });
      setAttached(null);
      toast.success('EPC removed from this survey');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <section className={`${workspacePanelCard} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Energy Performance Certificate
          </h3>
          <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
            Fetch the GOV.UK register certificate for this property and use it
            in About the property and the report energy section.
          </p>
        </div>
        <Leaf className={`h-4 w-4 shrink-0 ${workspaceTextMuted}`} />
      </div>

      {canEdit ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className={`text-xs ${workspaceTextMuted}`}>Address</Label>
            <Input
              className="mt-1"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="12 Example Street, Manchester"
            />
          </div>
          <div>
            <Label className={`text-xs ${workspaceTextMuted}`}>Postcode</Label>
            <Input
              className="mt-1"
              value={postcode}
              onChange={(event) => setPostcode(event.target.value)}
              placeholder="M20 4AP"
            />
          </div>
          <div>
            <Label className={`text-xs ${workspaceTextMuted}`}>UPRN</Label>
            <Input
              className="mt-1"
              value={uprn}
              onChange={(event) => setUprn(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void handleSave(configured)}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save address
            </Button>
            <Button
              type="button"
              size="sm"
              className={workspaceBtnPrimaryMd}
              disabled={searching || !configured}
              onClick={() => void handleFetch()}
            >
              {searching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Leaf className="mr-2 h-4 w-4" />
              )}
              Fetch EPC
            </Button>
          </div>
          {!configured ? (
            <p className={`text-xs sm:col-span-2 ${workspaceTextMuted}`}>
              EPC lookup is not enabled on this server yet. An admin needs to
              add the GOV.UK Energy Certificate Data API bearer token.
            </p>
          ) : null}
        </div>
      ) : null}

      {attached ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className={`text-xs ${workspaceTextMuted}`}>
              Current / potential
            </dt>
            <dd className="mt-1 flex items-center gap-2">
              <RatingBadge rating={attached.currentRating} />
              <span className={workspaceTextMuted}>→</span>
              <RatingBadge rating={attached.potentialRating} />
            </dd>
          </div>
          <div>
            <dt className={`text-xs ${workspaceTextMuted}`}>Certificate</dt>
            <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
              {attached.certificateNumber}
            </dd>
          </div>
          <div>
            <dt className={`text-xs ${workspaceTextMuted}`}>Lodged</dt>
            <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
              {attached.lodgementDate || '—'}
            </dd>
          </div>
          <div>
            <dt className={`text-xs ${workspaceTextMuted}`}>Floor area</dt>
            <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
              {attached.floorArea != null ? `${attached.floorArea} m²` : '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className={`text-xs ${workspaceTextMuted}`}>Fuel / heating</dt>
            <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
              {attached.fuelType || '—'}
            </dd>
          </div>
          {attached.recommendationsSummary ? (
            <div className="sm:col-span-2">
              <dt className={`text-xs ${workspaceTextMuted}`}>
                Recommendations
              </dt>
              <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
                {attached.recommendationsSummary}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 sm:col-span-2">
            <p className={`text-xs ${workspaceTextMuted}`}>
              Fetched {formatFetchedAt(attached.fetchedAt) ?? 'recently'} from
              the GOV.UK Energy Certificate Data API.
            </p>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void handleClear()}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </dl>
      ) : (
        <p className={`mt-4 text-sm ${workspaceTextMuted}`}>
          No EPC attached yet.
        </p>
      )}

      {hits.length > 0 ? (
        <ul className="mt-4 space-y-2">
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
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={attaching === hit.certificateNumber}
                onClick={() => void handleAttach(hit.certificateNumber)}
              >
                {attaching === hit.certificateNumber ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Use this certificate
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function SurveyEpcSummaryCard({
  attached,
}: {
  attached: SurveyEpcRecord | null;
}) {
  if (!attached) return null;
  return (
    <div className="mt-4 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
      <p className={`text-xs tracking-wide uppercase ${workspaceTextMuted}`}>
        Energy efficiency
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <RatingBadge rating={attached.currentRating} />
        <span className={`text-xs ${workspaceTextMuted}`}>potential</span>
        <RatingBadge rating={attached.potentialRating} />
        <span className={`text-sm ${workspaceTextMuted}`}>
          {attached.certificateNumber}
        </span>
      </div>
      {attached.fuelType || attached.floorArea != null ? (
        <p className={`mt-2 text-sm text-[var(--workspace-shell-text)]`}>
          {[
            attached.floorArea != null ? `${attached.floorArea} m²` : null,
            attached.fuelType,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
    </div>
  );
}
