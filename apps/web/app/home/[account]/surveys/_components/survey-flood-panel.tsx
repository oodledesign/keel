'use client';

import { useEffect, useState } from 'react';

import { Droplets, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import { isFloodFieldOverridden } from '~/lib/building-surveyor/flood/overrides';
import type {
  OverridableFloodField,
  SurveyFloodRecord,
} from '~/lib/building-surveyor/flood/types';
import { workspaceTextMuted } from '~/lib/workspace-ui';

import {
  clearSurveyFloodAction,
  pullSurveyFloodAction,
  updateSurveyFloodAction,
} from '../_lib/server/survey-flood-actions';

const FLOOD_ZONES = ['1', '2', '3'] as const;

function FieldSourceBadge({
  field,
  overridden,
}: {
  field: OverridableFloodField;
  overridden: readonly string[];
}) {
  const edited = isFloodFieldOverridden(field, overridden);
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

export function SurveyFloodPanel({
  accountId,
  accountSlug,
  proposalId,
  canEdit,
  attached: initialAttached,
  latitude,
  longitude,
}: {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  attached: SurveyFloodRecord | null;
  latitude: number | null;
  longitude: number | null;
}) {
  const [attached, setAttached] = useState(initialAttached);
  const [floodZone, setFloodZone] = useState(initialAttached?.floodZone ?? '');
  const [riversAndSea, setRiversAndSea] = useState(
    initialAttached?.riversAndSea ?? '',
  );
  const [surfaceWater, setSurfaceWater] = useState(
    initialAttached?.surfaceWater ?? '',
  );
  const [summary, setSummary] = useState(initialAttached?.summary ?? '');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setAttached(initialAttached);
    setFloodZone(initialAttached?.floodZone ?? '');
    setRiversAndSea(initialAttached?.riversAndSea ?? '');
    setSurfaceWater(initialAttached?.surfaceWater ?? '');
    setSummary(initialAttached?.summary ?? '');
  }, [initialAttached]);

  const sync = (next: SurveyFloodRecord | null) => {
    setAttached(next);
    setFloodZone(next?.floodZone ?? '');
    setRiversAndSea(next?.riversAndSea ?? '');
    setSurfaceWater(next?.surfaceWater ?? '');
    setSummary(next?.summary ?? '');
  };

  const hasPin = latitude != null && longitude != null;

  const handleRefresh = async () => {
    if (!canEdit || !hasPin) return;
    setRefreshing(true);
    try {
      const next = await pullSurveyFloodAction({
        accountId,
        accountSlug,
        proposalId,
        latitude,
        longitude,
      });
      sync(next);
      toast.success('Flood risk auto-pulled from the Environment Agency.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit || !attached) return;
    setSaving(true);
    try {
      const next = await updateSurveyFloodAction({
        accountId,
        accountSlug,
        proposalId,
        floodZone:
          floodZone === '1' || floodZone === '2' || floodZone === '3'
            ? floodZone
            : null,
        riversAndSea: riversAndSea.trim() || null,
        surfaceWater: surfaceWater.trim() || null,
        summary: summary.trim() || null,
      });
      sync(next);
      toast.success('Flood fields saved');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!canEdit) return;
    try {
      await clearSurveyFloodAction({
        accountId,
        accountSlug,
        proposalId,
      });
      sync(null);
      toast.success('Flood risk removed from this survey');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const overridden = attached?.overriddenFields ?? [];

  return (
    <div
      className="mt-5 border-t border-[color:var(--workspace-shell-border)] pt-5"
      data-test="survey-flood-prep"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Flood risk
          </h4>
          <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
            Auto-pulled from the Environment Agency Flood Map for Planning
            (rivers and sea Zones 2 and 3). Values are marked auto-pulled and
            can be edited.
          </p>
        </div>
        <Droplets className={`h-4 w-4 shrink-0 ${workspaceTextMuted}`} />
      </div>

      {canEdit && hasPin ? (
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={() => void handleRefresh()}
            data-test="survey-flood-refresh"
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {attached ? 'Refresh flood risk' : 'Pull flood risk'}
          </Button>
        </div>
      ) : (
        <p className={`mt-3 text-sm ${workspaceTextMuted}`}>
          Select an address with a map pin to auto-pull flood zone.
        </p>
      )}

      {attached ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className={`text-xs ${workspaceTextMuted}`}>
              Flood zone
              <FieldSourceBadge field="floodZone" overridden={overridden} />
            </Label>
            <select
              className="mt-1 w-full rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] px-3 py-2 text-sm text-[var(--workspace-shell-text)]"
              value={floodZone}
              disabled={!canEdit}
              onChange={(event) => setFloodZone(event.target.value)}
            >
              <option value="">—</option>
              {FLOOD_ZONES.map((zone) => (
                <option key={zone} value={zone}>
                  Zone {zone}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className={`text-xs ${workspaceTextMuted}`}>
              Rivers and sea
              <FieldSourceBadge field="riversAndSea" overridden={overridden} />
            </Label>
            <Input
              className="mt-1"
              value={riversAndSea}
              disabled={!canEdit}
              onChange={(event) => setRiversAndSea(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className={`text-xs ${workspaceTextMuted}`}>
              Surface water
              <FieldSourceBadge field="surfaceWater" overridden={overridden} />
            </Label>
            <Input
              className="mt-1"
              value={surfaceWater}
              disabled={!canEdit}
              onChange={(event) => setSurfaceWater(event.target.value)}
              placeholder="Not returned by the planning flood-zone layers"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className={`text-xs ${workspaceTextMuted}`}>
              Summary
              <FieldSourceBadge field="summary" overridden={overridden} />
            </Label>
            <Textarea
              className="mt-1 min-h-20"
              value={summary}
              disabled={!canEdit}
              onChange={(event) => setSummary(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            <p className={`text-xs ${workspaceTextMuted}`}>
              Flood Map for Planning
              {attached.activeWarningCount
                ? ` · ${attached.activeWarningCount} nearby warning${
                    attached.activeWarningCount === 1 ? '' : 's'
                  }`
                : ''}
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
                  disabled={saving}
                  onClick={() => void handleSave()}
                  data-test="survey-flood-save-edits"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save edits
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleClear()}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
