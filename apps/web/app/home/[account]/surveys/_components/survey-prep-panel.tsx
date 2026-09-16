'use client';

import { useState, useTransition } from 'react';

import { Droplets, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
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
  floodRiskBandLabel,
  isFloodRiskBand,
} from '~/lib/building-surveyor/flood/parse';
import {
  FLOOD_RISK_BANDS,
  GOV_UK_LONG_TERM_FLOOD_URL,
  type SurveyFloodRecord,
} from '~/lib/building-surveyor/flood/types';
import {
  HOME_SURVEY_LEVEL_OPTIONS,
  type SurveyLevel,
  normalizeSurveyLevel,
  surveyLevelLabel,
} from '~/lib/building-surveyor/survey-types';
import type { AddressSuggestion } from '~/lib/commercial/address-suggest.types';
import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

import {
  confirmSurveyAddressAction,
  pullSurveyFloodAction,
  updateSurveyFloodAction,
  updateSurveyLevelAction,
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

export function SurveyPrepPanel({
  accountId,
  accountSlug,
  proposalId,
  canEdit,
  epcConfigured,
  lookup: initialLookup,
  attachedEpc,
  flood: initialFlood,
  surveyLevel: initialLevel,
  onSurveyLevelChange,
  clientName,
  enquiryStage,
  propertyLabel,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  epcConfigured: boolean;
  lookup: SurveyPropertyLookup;
  attachedEpc: SurveyEpcRecord | null;
  flood: SurveyFloodRecord;
  surveyLevel: SurveyLevel;
  onSurveyLevelChange?: (level: SurveyLevel) => void;
  clientName: string;
  enquiryStage: string;
  propertyLabel: string;
}) {
  const [address, setAddress] = useState(initialLookup.address ?? '');
  const [postcode, setPostcode] = useState(initialLookup.postcode ?? '');
  const [uprn, setUprn] = useState(initialLookup.uprn ?? '');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [lookup, setLookup] = useState(initialLookup);
  const [flood, setFlood] = useState(initialFlood);
  const [floodBand, setFloodBand] = useState(initialFlood.band ?? '');
  const [floodSummary, setFloodSummary] = useState(initialFlood.summary ?? '');
  const [surveyLevel, setSurveyLevel] = useState(initialLevel);
  const [attached, setAttached] = useState(attachedEpc);
  const [confirming, setConfirming] = useState(false);
  const [pullingFlood, setPullingFlood] = useState(false);
  const [savingFlood, setSavingFlood] = useState(false);
  const [pendingLevel, startLevelTransition] = useTransition();

  const applySuggestion = (suggestion: AddressSuggestion) => {
    const nextAddress = formatAddress(suggestion) || suggestion.label;
    setAddress(nextAddress);
    setPostcode(suggestion.postcode ?? '');
    setLatitude(suggestion.latitude);
    setLongitude(suggestion.longitude);
  };

  const syncFlood = (next: SurveyFloodRecord) => {
    setFlood(next);
    setFloodBand(next.band ?? '');
    setFloodSummary(next.summary ?? '');
  };

  const handleConfirm = async () => {
    if (!canEdit) return;
    setConfirming(true);
    try {
      const result = await confirmSurveyAddressAction({
        accountId,
        accountSlug,
        proposalId,
        address: address.trim() || null,
        postcode: postcode.trim() || null,
        uprn: uprn.trim() || null,
        latitude,
        longitude,
        titleFromAddress:
          !propertyLabel || propertyLabel === 'Property not set',
      });
      setLookup({
        ...result.lookup,
        uprn: result.attached?.uprn ?? result.lookup.uprn,
      });
      setAddress(result.lookup.address ?? '');
      setPostcode(result.lookup.postcode ?? '');
      setUprn(result.attached?.uprn ?? result.lookup.uprn ?? '');
      syncFlood(result.flood);
      if (result.autoAttached && result.attached) {
        setAttached(result.attached);
        toast.success(
          'Address confirmed. Flood risk and EPC were auto-pulled — review and edit if needed.',
        );
        return;
      }
      toast.success(
        result.flood.band
          ? 'Address confirmed. Flood risk was auto-pulled and can be edited.'
          : 'Address confirmed.',
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setConfirming(false);
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
        address: address.trim() || null,
        postcode: postcode.trim() || null,
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

  const handleLevel = (next: SurveyLevel) => {
    const previous = surveyLevel;
    setSurveyLevel(next);
    onSurveyLevelChange?.(next);
    startLevelTransition(async () => {
      try {
        const result = await updateSurveyLevelAction({
          accountId,
          accountSlug,
          proposalId,
          surveyLevel: next,
        });
        setSurveyLevel(result.surveyLevel);
        onSurveyLevelChange?.(result.surveyLevel);
        toast.success(`${surveyLevelLabel(result.surveyLevel)} saved`);
      } catch (error) {
        setSurveyLevel(previous);
        onSurveyLevelChange?.(previous);
        toast.error(getErrorMessage(error));
      }
    });
  };

  return (
    <section
      className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)] sm:p-5"
      data-test="survey-prep-panel"
    >
      <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
        Project prep
      </h3>
      <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
        Search for the property, confirm the address, then review auto-pulled
        flood risk and EPC. Level 2 and Level 3 share one template — level only
        changes optional field visibility.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className={`text-xs ${workspaceTextMuted}`}>Client</dt>
          <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
            {clientName}
          </dd>
        </div>
        <div>
          <dt className={`text-xs ${workspaceTextMuted}`}>Enquiry stage</dt>
          <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
            {enquiryStage}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <Label className={`text-xs ${workspaceTextMuted}`}>Survey level</Label>
        {canEdit ? (
          <div className="mt-2 inline-flex gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-1 text-xs">
            {HOME_SURVEY_LEVEL_OPTIONS.map((option) => (
              <button
                key={option.level}
                type="button"
                disabled={pendingLevel}
                data-test={`survey-level-${option.level}`}
                onClick={() => handleLevel(option.level)}
                className={`rounded-full px-3 py-1.5 font-medium ${
                  surveyLevel === option.level
                    ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                    : 'text-[var(--workspace-shell-text-muted)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm">{surveyLevelLabel(surveyLevel)}</p>
        )}
        <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
          One RICS Home Survey template. Level{' '}
          {normalizeSurveyLevel(surveyLevel)} hides the other level&apos;s
          optional detail fields (for example J.valuation on Level 2, J1–J5 on
          Level 3).
        </p>
      </div>

      {canEdit ? (
        <div className="mt-5 space-y-3">
          <AddressSearchField
            label="Find property"
            placeholder="Start typing a UK address or postcode…"
            onSelect={applySuggestion}
          />
          <div>
            <Label className={`text-xs ${workspaceTextMuted}`}>Address</Label>
            <Textarea
              className="mt-1 min-h-16"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="12 Example Street, Bath"
              data-test="survey-prep-address"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className={`text-xs ${workspaceTextMuted}`}>
                Postcode
              </Label>
              <Input
                className="mt-1"
                value={postcode}
                onChange={(event) => setPostcode(event.target.value)}
                placeholder="BA1 1UA"
                data-test="survey-prep-postcode"
              />
            </div>
            <div>
              <Label className={`text-xs ${workspaceTextMuted}`}>UPRN</Label>
              <Input
                className="mt-1"
                value={uprn}
                onChange={(event) => setUprn(event.target.value)}
                placeholder="Filled from EPC when available"
                data-test="survey-prep-uprn"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className={workspaceBtnPrimaryMd}
            disabled={confirming}
            onClick={() => void handleConfirm()}
            data-test="survey-prep-confirm-address"
          >
            {confirming ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Confirm address
          </Button>
        </div>
      ) : (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className={`text-xs ${workspaceTextMuted}`}>Address</dt>
            <dd className="mt-1 text-sm text-[var(--workspace-shell-text)]">
              {address || 'Not recorded'}
            </dd>
          </div>
          <div>
            <dt className={`text-xs ${workspaceTextMuted}`}>Postcode</dt>
            <dd className="mt-1 text-sm">{postcode || '—'}</dd>
          </div>
          {uprn ? (
            <div>
              <dt className={`text-xs ${workspaceTextMuted}`}>UPRN</dt>
              <dd className="mt-1 text-sm">{uprn}</dd>
            </div>
          ) : null}
        </dl>
      )}

      <div
        className="mt-6 border-t border-[color:var(--workspace-shell-border)] pt-5"
        data-test="survey-flood-prep"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Flood risk
              {flood.band || flood.source ? (
                <SourceBadge edited={flood.overridden} />
              ) : null}
            </h4>
            <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
              Auto-pulled from the Environment Agency present-day rivers and sea
              extents (OGC Features, no key) once the address is confirmed.
              Override if the site inspection differs.
            </p>
          </div>
          <Droplets className={`h-4 w-4 shrink-0 ${workspaceTextMuted}`} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className={`text-xs ${workspaceTextMuted}`}>
              Long-term band
            </Label>
            <select
              className="mt-1 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm text-[var(--workspace-shell-text)]"
              value={floodBand}
              disabled={!canEdit}
              onChange={(event) => setFloodBand(event.target.value)}
              data-test="survey-flood-band"
            >
              <option value="">—</option>
              {FLOOD_RISK_BANDS.map((band) => (
                <option key={band} value={band}>
                  {floodRiskBandLabel(band)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <p className={`text-sm ${workspaceTextMuted}`}>
              {flood.pulledBand
                ? `Register band: ${floodRiskBandLabel(flood.pulledBand)}`
                : 'Confirm the address to pull a band.'}
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label className={`text-xs ${workspaceTextMuted}`}>Summary</Label>
            <Textarea
              className="mt-1 min-h-20"
              value={floodSummary}
              disabled={!canEdit}
              onChange={(event) => setFloodSummary(event.target.value)}
              data-test="survey-flood-summary"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <a
            href={GOV_UK_LONG_TERM_FLOOD_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--workspace-shell-accent-text)] hover:text-[var(--ozer-accent)]"
          >
            Check your long-term flood risk on GOV.UK
          </a>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pullingFlood}
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
      </div>

      <SurveyEpcPanel
        key={`${attached?.certificateNumber ?? 'none'}:${attached?.fetchedAt ?? ''}`}
        accountId={accountId}
        accountSlug={accountSlug}
        proposalId={proposalId}
        canEdit={canEdit}
        configured={epcConfigured}
        lookup={lookup}
        attached={attached}
        hideAddress
      />
    </section>
  );
}
