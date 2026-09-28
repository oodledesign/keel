'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Droplets, Loader2, MapPin } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { AddressSearchField } from '~/components/commercial/address-search-field';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import type {
  SurveyEpcRecord,
  SurveyPropertyLookup,
} from '~/lib/building-surveyor/epc/types';
import {
  floodPlanningZoneLabel,
  floodRiskBandLabel,
  isFloodRiskBand,
} from '~/lib/building-surveyor/flood/parse';
import {
  EA_FLOOD_ZONES_ATTRIBUTION,
  EA_FLOOD_ZONES_DATASET_URL,
  EA_FLOOD_ZONES_DISCLAIMER,
  EA_SURFACE_WATER_NOTE,
  FLOOD_PLANNING_ZONE_OPTIONS,
  GOV_UK_FLOOD_MAP_FOR_PLANNING_URL,
  OPEN_GOVERNMENT_LICENCE_URL,
  type SurveyFloodRecord,
} from '~/lib/building-surveyor/flood/types';
import type { AddressSuggestion } from '~/lib/commercial/address-suggest.types';
import {
  workspaceBtnPrimaryMd,
  workspaceLinkAccent,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  confirmSurveyAddressAction,
  pullSurveyFloodAction,
  updateSurveyFloodAction,
} from '../_lib/server/survey-prep-actions';
import { SurveyEpcPanel } from './survey-epc-panel';

function SourceBadge({ edited }: { edited: boolean }) {
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

function formatAddress(suggestion: AddressSuggestion) {
  return [
    suggestion.addressLine1,
    suggestion.addressLine2,
    suggestion.town,
    suggestion.county,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

export function SurveyPropertyPanel({
  accountId,
  accountSlug,
  proposalId,
  proposalTitle,
  canEdit,
  epcConfigured,
  lookup,
  onLookupChange,
  attachedEpc,
  onAttachedEpcChange,
  flood: initialFlood,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  proposalTitle: string | null;
  canEdit: boolean;
  epcConfigured: boolean;
  lookup: SurveyPropertyLookup;
  onLookupChange: (lookup: SurveyPropertyLookup) => void;
  attachedEpc: SurveyEpcRecord | null;
  onAttachedEpcChange: (attached: SurveyEpcRecord | null) => void;
  flood: SurveyFloodRecord;
}) {
  const router = useRouter();
  const hasAddress = Boolean(lookup.address?.trim() || lookup.postcode?.trim());
  const [editingAddress, setEditingAddress] = useState(!hasAddress);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualAddress, setManualAddress] = useState(lookup.address ?? '');
  const [manualPostcode, setManualPostcode] = useState(lookup.postcode ?? '');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [flood, setFlood] = useState(initialFlood);
  const [floodBand, setFloodBand] = useState(initialFlood.band ?? '');
  const [floodSummary, setFloodSummary] = useState(initialFlood.summary ?? '');
  const [pullingFlood, setPullingFlood] = useState(false);
  const [savingFlood, setSavingFlood] = useState(false);

  const syncFlood = (next: SurveyFloodRecord) => {
    setFlood(next);
    setFloodBand(next.band ?? '');
    setFloodSummary(next.summary ?? '');
  };

  const saveAddress = async (input: {
    address: string;
    postcode: string;
    latitude: number | null;
    longitude: number | null;
  }) => {
    if (!canEdit) return;
    const title = proposalTitle?.trim() ?? '';
    const titleFromAddress =
      !title ||
      title === 'Building survey' ||
      title === lookup.address?.trim() ||
      title.startsWith('Survey for ');
    const sameAddress =
      input.address.trim() === (lookup.address?.trim() ?? '') &&
      input.postcode.trim() === (lookup.postcode?.trim() ?? '');

    setSavingAddress(true);
    try {
      const result = await confirmSurveyAddressAction({
        accountId,
        accountSlug,
        proposalId,
        address: input.address.trim() || null,
        postcode: input.postcode.trim() || null,
        uprn: sameAddress ? lookup.uprn : null,
        latitude: input.latitude,
        longitude: input.longitude,
        titleFromAddress,
        suggestEpc: false,
      });
      onLookupChange(result.lookup);
      syncFlood(result.flood);
      setLatitude(input.latitude);
      setLongitude(input.longitude);
      setEditingAddress(false);
      setManualEntry(false);
      toast.success(
        result.flood.band
          ? 'Address saved. Flood risk updated.'
          : 'Address saved.',
      );
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingAddress(false);
    }
  };

  const handlePullFlood = async () => {
    if (!canEdit) return;
    setPullingFlood(true);
    try {
      const next = await pullSurveyFloodAction({
        accountId,
        accountSlug,
        proposalId,
        address: lookup.address?.trim() || null,
        postcode: lookup.postcode?.trim() || null,
        latitude,
        longitude,
      });
      syncFlood(next);
      toast.success(
        next.overridden
          ? 'Flood risk refreshed. Your edits were kept.'
          : 'Flood risk updated from the Environment Agency.',
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPullingFlood(false);
    }
  };

  const handleSaveFlood = async () => {
    if (!canEdit) return;
    setSavingFlood(true);
    try {
      const next = await updateSurveyFloodAction({
        accountId,
        accountSlug,
        proposalId,
        band: isFloodRiskBand(floodBand) ? floodBand : null,
        summary: floodSummary.trim() || null,
      });
      syncFlood(next);
      toast.success('Flood risk saved');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingFlood(false);
    }
  };

  return (
    <div
      className="grid gap-5 xl:grid-cols-2"
      data-test="survey-property-panel"
    >
      <div className="space-y-5">
        <Card className={workspacePanelCard}>
          <CardContent className="p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--workspace-shell-text)]">
              <MapPin className={`h-4 w-4 ${workspaceTextMuted}`} />
              Property address
            </h3>

            {!editingAddress || !canEdit ? (
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-[var(--workspace-shell-text)]">
                    {lookup.address?.trim() || 'No address yet'}
                  </p>
                  {lookup.postcode ? (
                    <p className={`mt-0.5 ${workspaceTextMuted}`}>
                      {lookup.postcode}
                    </p>
                  ) : null}
                </div>
                {canEdit ? (
                  <button
                    type="button"
                    className={`shrink-0 text-sm ${workspaceLinkAccent}`}
                    onClick={() => {
                      setManualAddress(lookup.address ?? '');
                      setManualPostcode(lookup.postcode ?? '');
                      setEditingAddress(true);
                    }}
                    data-test="survey-change-address"
                  >
                    Change address
                  </button>
                ) : null}
              </div>
            ) : manualEntry ? (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className={`text-xs ${workspaceTextMuted}`}>
                    Address
                  </Label>
                  <Textarea
                    className="min-h-16"
                    value={manualAddress}
                    onChange={(event) => setManualAddress(event.target.value)}
                    placeholder="12 Example Street, Bath"
                    data-test="survey-prep-address"
                  />
                </div>
                <div className="space-y-1.5 sm:max-w-48">
                  <Label className={`text-xs ${workspaceTextMuted}`}>
                    Postcode
                  </Label>
                  <Input
                    value={manualPostcode}
                    onChange={(event) => setManualPostcode(event.target.value)}
                    placeholder="BA1 1UA"
                    data-test="survey-prep-postcode"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className={workspaceBtnPrimaryMd}
                    disabled={
                      savingAddress ||
                      (!manualAddress.trim() && !manualPostcode.trim())
                    }
                    onClick={() =>
                      void saveAddress({
                        address: manualAddress,
                        postcode: manualPostcode,
                        latitude: null,
                        longitude: null,
                      })
                    }
                    data-test="survey-prep-save-address"
                  >
                    {savingAddress ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Save address
                  </button>
                  <button
                    type="button"
                    className={`text-sm ${workspaceLinkAccent}`}
                    onClick={() => setManualEntry(false)}
                  >
                    Search instead
                  </button>
                  {hasAddress ? (
                    <button
                      type="button"
                      className={`text-sm ${workspaceTextMuted} hover:text-[var(--workspace-shell-text)]`}
                      onClick={() => setEditingAddress(false)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <AddressSearchField
                  label="Find property"
                  placeholder="Start typing a UK address or postcode…"
                  hint={null}
                  autoFocus={hasAddress}
                  onSelect={(suggestion) =>
                    void saveAddress({
                      address: formatAddress(suggestion) || suggestion.label,
                      postcode: suggestion.postcode ?? '',
                      latitude: suggestion.latitude,
                      longitude: suggestion.longitude,
                    })
                  }
                />
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {savingAddress ? (
                    <span
                      className={`inline-flex items-center gap-1.5 ${workspaceTextMuted}`}
                    >
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving…
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={workspaceLinkAccent}
                    onClick={() => setManualEntry(true)}
                  >
                    Enter address manually
                  </button>
                  {hasAddress ? (
                    <button
                      type="button"
                      className={`${workspaceTextMuted} hover:text-[var(--workspace-shell-text)]`}
                      onClick={() => setEditingAddress(false)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={workspacePanelCard} data-test="survey-flood-prep">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center text-sm font-semibold text-[var(--workspace-shell-text)]">
                  <Droplets className={`mr-2 h-4 w-4 ${workspaceTextMuted}`} />
                  Flood risk
                  {flood.band || flood.source ? (
                    <SourceBadge edited={flood.overridden} />
                  ) : null}
                </h3>
                <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
                  Pulled from the Environment Agency Flood Map for Planning
                  (England) when you save the address. Override it if the site
                  inspection differs.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className={`text-xs ${workspaceTextMuted}`}>
                  Flood zone
                </Label>
                <select
                  className="w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm text-[var(--workspace-shell-text)]"
                  value={floodBand}
                  disabled={!canEdit}
                  onChange={(event) => setFloodBand(event.target.value)}
                  data-test="survey-flood-band"
                >
                  <option value="">—</option>
                  {FLOOD_PLANNING_ZONE_OPTIONS.map((option) => (
                    <option key={option.band} value={option.band}>
                      {option.label}
                    </option>
                  ))}
                  {floodBand === 'low' ? (
                    <option value="low">{floodRiskBandLabel('low')}</option>
                  ) : null}
                </select>
              </div>
              <div className="flex items-end">
                <p className={`text-sm ${workspaceTextMuted}`}>
                  {flood.coverage === 'not_england'
                    ? `England only. This address is in ${flood.country ?? 'a nation outside England'}.`
                    : flood.planningZone
                      ? `EA zone: ${floodPlanningZoneLabel(flood.planningZone)}`
                      : flood.pulledBand
                        ? `EA zone: ${floodRiskBandLabel(flood.pulledBand)}`
                        : 'Save the address to pull a flood zone.'}
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className={`text-xs ${workspaceTextMuted}`}>
                  Summary
                </Label>
                <Textarea
                  className="min-h-20"
                  value={floodSummary}
                  disabled={!canEdit}
                  onChange={(event) => setFloodSummary(event.target.value)}
                  data-test="survey-flood-summary"
                />
              </div>
            </div>

            <p
              className={`mt-3 text-xs ${workspaceTextMuted}`}
              data-test="survey-flood-disclaimer"
            >
              {EA_FLOOD_ZONES_DISCLAIMER} {EA_SURFACE_WATER_NOTE}
            </p>
            <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
              {EA_FLOOD_ZONES_ATTRIBUTION}{' '}
              <a
                href={EA_FLOOD_ZONES_DATASET_URL}
                target="_blank"
                rel="noreferrer"
                className={workspaceLinkAccent}
              >
                Dataset
              </a>
              {' · '}
              <a
                href={OPEN_GOVERNMENT_LICENCE_URL}
                target="_blank"
                rel="noreferrer"
                className={workspaceLinkAccent}
              >
                OGL v3.0
              </a>
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <a
                href={GOV_UK_FLOOD_MAP_FOR_PLANNING_URL}
                target="_blank"
                rel="noreferrer"
                className={`text-xs ${workspaceLinkAccent}`}
              >
                Flood Map for Planning on GOV.UK
              </a>
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pullingFlood || !hasAddress}
                    onClick={() => void handlePullFlood()}
                    data-test="survey-flood-refresh"
                  >
                    {pullingFlood ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Refresh flood risk
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingFlood}
                    onClick={() => void handleSaveFlood()}
                    data-test="survey-flood-save"
                  >
                    {savingFlood ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Save edits
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <SurveyEpcPanel
          key={`${lookup.address ?? ''}|${lookup.postcode ?? ''}`}
          accountId={accountId}
          accountSlug={accountSlug}
          proposalId={proposalId}
          canEdit={canEdit}
          configured={epcConfigured}
          lookup={lookup}
          attached={attachedEpc}
          onAttachedChange={(next) => {
            onAttachedEpcChange(next);
            if (next?.uprn && next.uprn !== lookup.uprn) {
              onLookupChange({ ...lookup, uprn: next.uprn });
            }
          }}
        />
      </div>
    </div>
  );
}
