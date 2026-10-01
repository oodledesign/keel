'use client';

import { useState } from 'react';

import { Leaf, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import type { OverridableEpcField } from '~/lib/building-surveyor/epc/overrides';
import { isEpcFieldOverridden } from '~/lib/building-surveyor/epc/overrides';
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
  refreshSurveyEpcAction,
  searchSurveyEpcAction,
  updateSurveyEpcAction,
} from '../_lib/server/survey-epc-actions';

type RankedHit = EpcSearchHit & {
  matchScore: number;
  addressLabel: string;
};

const ENERGY_BANDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

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

function FieldSourceBadge({
  field,
  overridden,
}: {
  field: OverridableEpcField;
  overridden: readonly string[];
}) {
  const edited = isEpcFieldOverridden(field, overridden);
  return (
    <span
      className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
        edited
          ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
          : 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
      }`}
    >
      {edited ? 'Edited' : 'Auto-pulled'}
    </span>
  );
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
  lookup,
  attached: initialAttached,
  onAttachedChange,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  configured: boolean;
  lookup: SurveyPropertyLookup;
  attached: SurveyEpcRecord | null;
  onAttachedChange?: (attached: SurveyEpcRecord | null) => void;
}) {
  const [attached, setAttached] = useState(initialAttached);
  const [hits, setHits] = useState<RankedHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [savingFields, setSavingFields] = useState(false);
  const [currentRating, setCurrentRating] = useState(
    initialAttached?.currentRating ?? '',
  );
  const [potentialRating, setPotentialRating] = useState(
    initialAttached?.potentialRating ?? '',
  );
  const [lodgementDate, setLodgementDate] = useState(
    initialAttached?.lodgementDate ?? '',
  );
  const [floorArea, setFloorArea] = useState(
    initialAttached?.floorArea != null ? String(initialAttached.floorArea) : '',
  );
  const [fuelType, setFuelType] = useState(initialAttached?.fuelType ?? '');
  const [recommendationsSummary, setRecommendationsSummary] = useState(
    initialAttached?.recommendationsSummary ?? '',
  );

  const hasAddress = Boolean(
    lookup.address?.trim() || lookup.postcode?.trim() || lookup.uprn?.trim(),
  );
  const uprn = attached?.uprn ?? lookup.uprn;

  const syncAttached = (next: SurveyEpcRecord | null) => {
    setAttached(next);
    onAttachedChange?.(next);
    setCurrentRating(next?.currentRating ?? '');
    setPotentialRating(next?.potentialRating ?? '');
    setLodgementDate(next?.lodgementDate ?? '');
    setFloorArea(next?.floorArea != null ? String(next.floorArea) : '');
    setFuelType(next?.fuelType ?? '');
    setRecommendationsSummary(next?.recommendationsSummary ?? '');
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
      syncAttached(next);
      setHits([]);
      toast.success('EPC attached. Fields are auto-pulled and editable.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAttaching(null);
    }
  };

  const handlePull = async () => {
    if (!canEdit || !configured) return;
    setSearching(true);
    try {
      const result = await searchSurveyEpcAction({
        accountId,
        accountSlug,
        proposalId,
        address: lookup.address?.trim() || null,
        postcode: lookup.postcode?.trim() || null,
        uprn: lookup.uprn?.trim() || null,
      });
      if (!result.configured) {
        toast.error('EPC lookup is unavailable.');
        return;
      }
      if (result.highConfidenceCertificateNumber) {
        await handleAttach(result.highConfidenceCertificateNumber);
        return;
      }
      setHits(result.hits);
      if (result.hits.length === 0) {
        toast.error('No energy certificates matched this address.');
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSearching(false);
    }
  };

  const handleRefresh = async () => {
    if (!canEdit || !configured || !attached) return;
    setRefreshing(true);
    try {
      const next = await refreshSurveyEpcAction({
        accountId,
        accountSlug,
        proposalId,
      });
      syncAttached(next);
      toast.success('EPC refreshed. Your edits were kept.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRefreshing(false);
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
      syncAttached(null);
      toast.success('EPC removed from this survey');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleSaveOverrides = async () => {
    if (!canEdit || !attached) return;
    const parsedFloor = floorArea.trim() === '' ? null : Number(floorArea);
    if (floorArea.trim() && !Number.isFinite(parsedFloor)) {
      toast.error('Floor area must be a number.');
      return;
    }
    setSavingFields(true);
    try {
      const next = await updateSurveyEpcAction({
        accountId,
        accountSlug,
        proposalId,
        currentRating: currentRating.trim() || null,
        potentialRating: potentialRating.trim() || null,
        lodgementDate: lodgementDate.trim() || null,
        floorArea: parsedFloor,
        fuelType: fuelType.trim() || null,
        recommendationsSummary: recommendationsSummary.trim() || null,
      });
      syncAttached(next);
      toast.success('EPC fields saved');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingFields(false);
    }
  };

  const overridden = attached?.overriddenFields ?? [];

  return (
    <Card className={workspacePanelCard} data-test="survey-epc-prep">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--workspace-shell-text)]">
              <Leaf className={`h-4 w-4 ${workspaceTextMuted}`} />
              Energy Performance Certificate
            </h3>
            <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
              Pull the matching certificate from the GOV.UK register. Values
              feed Energy efficiency (J) and About the property, and can be
              edited.
            </p>
          </div>
          {canEdit && configured ? (
            attached ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 whitespace-nowrap"
                disabled={refreshing}
                onClick={() => void handleRefresh()}
                data-test="survey-epc-refresh"
              >
                {refreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh EPC
              </Button>
            ) : (
              <button
                type="button"
                className={`${workspaceBtnPrimaryMd} shrink-0 whitespace-nowrap`}
                disabled={searching || attaching != null || !hasAddress}
                title={
                  hasAddress ? undefined : 'Add the property address first'
                }
                onClick={() => void handlePull()}
                data-test="survey-epc-pull"
              >
                {searching || attaching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Leaf className="h-4 w-4" />
                )}
                Pull EPC
              </button>
            )
          ) : null}
        </div>

        {!configured ? (
          <p className={`mt-3 text-sm ${workspaceTextMuted}`}>
            EPC lookup is not configured on this environment.
          </p>
        ) : null}

        {uprn ? (
          <p
            className={`mt-3 text-xs ${workspaceTextMuted}`}
            title="Unique Property Reference Number. The national ID for this property, used to match the EPC."
          >
            Property reference (UPRN): {uprn}
          </p>
        ) : null}

        {attached ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label className={`text-xs ${workspaceTextMuted}`}>
                Current rating
                <FieldSourceBadge
                  field="currentRating"
                  overridden={overridden}
                />
              </Label>
              <select
                className="mt-1 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm text-[var(--workspace-shell-text)]"
                value={currentRating}
                disabled={!canEdit}
                onChange={(event) => setCurrentRating(event.target.value)}
              >
                <option value="">—</option>
                {ENERGY_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {band}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className={`text-xs ${workspaceTextMuted}`}>
                Potential rating
                <FieldSourceBadge
                  field="potentialRating"
                  overridden={overridden}
                />
              </Label>
              <select
                className="mt-1 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm text-[var(--workspace-shell-text)]"
                value={potentialRating}
                disabled={!canEdit}
                onChange={(event) => setPotentialRating(event.target.value)}
              >
                <option value="">—</option>
                {ENERGY_BANDS.map((band) => (
                  <option key={band} value={band}>
                    {band}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className={`text-xs ${workspaceTextMuted}`}>
                Lodged
                <FieldSourceBadge
                  field="lodgementDate"
                  overridden={overridden}
                />
              </Label>
              <Input
                className="mt-1"
                type="date"
                value={lodgementDate}
                disabled={!canEdit}
                onChange={(event) => setLodgementDate(event.target.value)}
              />
            </div>
            <div>
              <Label className={`text-xs ${workspaceTextMuted}`}>
                Floor area (m²)
                <FieldSourceBadge field="floorArea" overridden={overridden} />
              </Label>
              <Input
                className="mt-1"
                inputMode="decimal"
                value={floorArea}
                disabled={!canEdit}
                onChange={(event) => setFloorArea(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className={`text-xs ${workspaceTextMuted}`}>
                Fuel / heating
                <FieldSourceBadge field="fuelType" overridden={overridden} />
              </Label>
              <Input
                className="mt-1"
                value={fuelType}
                disabled={!canEdit}
                onChange={(event) => setFuelType(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className={`text-xs ${workspaceTextMuted}`}>
                Recommendations
                <FieldSourceBadge
                  field="recommendationsSummary"
                  overridden={overridden}
                />
              </Label>
              <Textarea
                className="mt-1 min-h-20"
                value={recommendationsSummary}
                disabled={!canEdit}
                onChange={(event) =>
                  setRecommendationsSummary(event.target.value)
                }
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
              <p className={`text-xs ${workspaceTextMuted}`}>
                Certificate {attached.certificateNumber}
                {formatFetchedAt(attached.fetchedAt)
                  ? ` · pulled ${formatFetchedAt(attached.fetchedAt)}`
                  : ''}
              </p>
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingFields}
                    onClick={() => void handleSaveOverrides()}
                    data-test="survey-epc-save-edits"
                  >
                    {savingFields ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Save edits
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleClear()}
                    data-test="survey-epc-remove"
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : configured && hits.length === 0 ? (
          <p className={`mt-3 text-sm ${workspaceTextMuted}`}>
            {hasAddress
              ? 'No EPC attached yet.'
              : 'Add the property address, then pull the EPC.'}
          </p>
        ) : null}

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
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={attaching === hit.certificateNumber}
                    onClick={() => void handleAttach(hit.certificateNumber)}
                    data-test={`survey-epc-use-${hit.certificateNumber}`}
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
      </CardContent>
    </Card>
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
        {attached.overriddenFields.length > 0 ? (
          <span className={`text-xs ${workspaceTextMuted}`}>
            {attached.overriddenFields.length} edited
          </span>
        ) : (
          <span className={`text-xs ${workspaceTextMuted}`}>Auto-pulled</span>
        )}
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
