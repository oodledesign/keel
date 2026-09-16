'use client';

import { useEffect, useState } from 'react';

import { Leaf, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
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
import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

import {
  attachSurveyEpcAction,
  clearSurveyEpcAction,
  refreshSurveyEpcAction,
  saveSurveyPropertyLookupAction,
  searchSurveyEpcAction,
  updateSurveyEpcAction,
} from '../_lib/server/survey-epc-actions';
import type { SurveyEpcSearchResult } from '../_lib/server/survey-epc.service';

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
  lookup: initialLookup,
  attached: initialAttached,
  hideAddress = false,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  configured: boolean;
  lookup: SurveyPropertyLookup;
  attached: SurveyEpcRecord | null;
  /** When true, the parent prep panel owns address fields. */
  hideAddress?: boolean;
}) {
  const [address, setAddress] = useState(initialLookup.address ?? '');
  const [postcode, setPostcode] = useState(initialLookup.postcode ?? '');
  const [uprn, setUprn] = useState(initialLookup.uprn ?? '');
  const [attached, setAttached] = useState(initialAttached);
  const [hits, setHits] = useState<RankedHit[]>([]);
  const [saving, setSaving] = useState(false);
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

  const syncAttached = (next: SurveyEpcRecord | null) => {
    setAttached(next);
    setCurrentRating(next?.currentRating ?? '');
    setPotentialRating(next?.potentialRating ?? '');
    setLodgementDate(next?.lodgementDate ?? '');
    setFloorArea(next?.floorArea != null ? String(next.floorArea) : '');
    setFuelType(next?.fuelType ?? '');
    setRecommendationsSummary(next?.recommendationsSummary ?? '');
  };

  // Parent prep panel owns the address after confirm; keep Fetch EPC
  // in sync without remounting this panel on every keystroke.
  useEffect(() => {
    setAddress(initialLookup.address ?? '');
    setPostcode(initialLookup.postcode ?? '');
    setUprn(initialLookup.uprn ?? '');
  }, [initialLookup.address, initialLookup.postcode, initialLookup.uprn]);

  const applySearch = (result: SurveyEpcSearchResult) => {
    setHits(result.hits);
    if (result.hits.length === 0) {
      toast.error('No energy certificates matched this address.');
    }
  };

  const handleConfirmAddress = async () => {
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
        suggest: configured,
      });
      setAddress(result.lookup.address ?? '');
      setPostcode(result.lookup.postcode ?? '');
      setUprn(result.lookup.uprn ?? '');

      if (result.autoAttached && result.attached) {
        syncAttached(result.attached);
        setHits([]);
        toast.success(
          'Address confirmed. EPC auto-pulled from the register — review and edit if needed.',
        );
        return;
      }

      toast.success('Address confirmed');
      if (result.suggestions) applySearch(result.suggestions);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async () => {
    if (!canEdit || !configured) return;
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
        toast.error('EPC lookup is unavailable.');
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
      syncAttached(next);
      setHits([]);
      if (next.uprn) setUprn(next.uprn);
      toast.success('EPC attached. Fields are auto-pulled and editable.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAttaching(null);
    }
  };

  const handleRefresh = async () => {
    if (!canEdit || !configured) return;
    if (!attached) {
      await handleSearch();
      return;
    }
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
    <div
      className="mt-5 border-t border-[color:var(--workspace-shell-border)] pt-5"
      data-test="survey-epc-prep"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            {hideAddress
              ? 'Energy Performance Certificate'
              : 'Property address'}
          </h4>
          <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
            {hideAddress
              ? 'Fetch the matching certificate from the GOV.UK register. Values are marked auto-pulled and can be edited.'
              : 'Confirm the survey address to auto-pull the Energy Performance Certificate. Values are marked auto-pulled and can be edited.'}
          </p>
        </div>
        <Leaf className={`h-4 w-4 shrink-0 ${workspaceTextMuted}`} />
      </div>

      {hideAddress ? (
        canEdit && configured ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={searching || refreshing}
              onClick={() => void handleRefresh()}
              data-test="survey-epc-refresh"
            >
              {refreshing || searching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {attached ? 'Refresh EPC' : 'Fetch EPC'}
            </Button>
          </div>
        ) : !configured ? (
          <p className={`mt-3 text-sm ${workspaceTextMuted}`}>
            EPC lookup is not configured on this environment.
          </p>
        ) : null
      ) : canEdit ? (
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
              placeholder="If known"
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="button"
              size="sm"
              className={workspaceBtnPrimaryMd}
              disabled={saving}
              onClick={() => void handleConfirmAddress()}
              data-test="survey-epc-confirm-address"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm address
            </Button>
            {configured ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={searching || refreshing}
                  onClick={() => void handleRefresh()}
                  data-test="survey-epc-refresh"
                >
                  {refreshing || searching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {attached ? 'Refresh EPC' : 'Find EPC'}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className={`text-xs ${workspaceTextMuted}`}>Address</dt>
            <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
              {address || 'Not recorded'}
            </dd>
          </div>
          <div>
            <dt className={`text-xs ${workspaceTextMuted}`}>Postcode</dt>
            <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
              {postcode || '—'}
            </dd>
          </div>
          {uprn ? (
            <div>
              <dt className={`text-xs ${workspaceTextMuted}`}>UPRN</dt>
              <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
                {uprn}
              </dd>
            </div>
          ) : null}
        </dl>
      )}

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Energy (J) / About the property
        </h4>
        <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
          Register data used in Energy efficiency (J). Floor area and fuel can
          also appear in About the property. L2 and L3 share this template.
        </p>
      </div>

      {attached ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className={`text-xs ${workspaceTextMuted}`}>
              Current rating
              <FieldSourceBadge field="currentRating" overridden={overridden} />
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
              <FieldSourceBadge field="lodgementDate" overridden={overridden} />
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
      ) : (
        <p className={`mt-3 text-sm ${workspaceTextMuted}`}>
          Confirm the address to auto-pull an EPC for this property.
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
    </div>
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
