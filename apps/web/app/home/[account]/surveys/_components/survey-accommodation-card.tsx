'use client';

import { useState, useTransition } from 'react';

import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  ACCOMMODATION_FLOORS,
  ACCOMMODATION_ROOMS,
  type AccommodationFloorKey,
  type AccommodationRoomKey,
  CENTRAL_HEATING,
  MAIN_SERVICES,
  type SurveyAccommodation,
  type SurveyServices,
} from '~/lib/building-surveyor/survey-report-details';
import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

import type { UpdateSurveyServicesInput } from '../_lib/schema/survey-report-details.schema';
import {
  updateSurveyAccommodationAction,
  updateSurveyServicesAction,
} from '../_lib/server/survey-report-details-actions';

type Props = {
  accountId: string;
  accountSlug: string;
  proposalId: string;
  canEdit: boolean;
  accommodation: SurveyAccommodation;
  services: SurveyServices | null;
};

function withCount(
  accommodation: SurveyAccommodation,
  floor: AccommodationFloorKey,
  room: AccommodationRoomKey,
  count: number,
): SurveyAccommodation {
  const row = { ...(accommodation[floor] ?? {}) };
  if (count > 0) row[room] = count;
  else delete row[room];
  const next = { ...accommodation };
  if (Object.keys(row).length > 0) next[floor] = row;
  else delete next[floor];
  return next;
}

export function SurveyAccommodationCard({
  accountId,
  accountSlug,
  proposalId,
  canEdit,
  accommodation,
  services,
}: Props) {
  const [counts, setCounts] = useState(accommodation);
  const [savedCounts, setSavedCounts] = useState(accommodation);
  const [selected, setSelected] = useState<SurveyServices>(
    services ?? { main: [], heating: [] },
  );
  const [pending, startTransition] = useTransition();

  const saveCounts = () => {
    if (JSON.stringify(counts) === JSON.stringify(savedCounts)) return;
    const next = counts;
    startTransition(async () => {
      try {
        const result = await updateSurveyAccommodationAction({
          accountId,
          accountSlug,
          proposalId,
          accommodation: next,
        });
        setSavedCounts(result);
        toast.success('Accommodation saved');
      } catch (error) {
        setCounts(savedCounts);
        toast.error(getErrorMessage(error));
      }
    });
  };

  const toggleService = (group: keyof SurveyServices, key: string) => {
    const previous = selected;
    const current = previous[group];
    let values = current.includes(key)
      ? current.filter((value) => value !== key)
      : [...current, key];
    if (group === 'heating') {
      values =
        key === 'none' && values.includes('none')
          ? ['none']
          : values.filter((value) => value !== 'none');
    }
    const next = { ...previous, [group]: values };
    setSelected(next);
    startTransition(async () => {
      try {
        await updateSurveyServicesAction({
          accountId,
          accountSlug,
          proposalId,
          services: next as UpdateSurveyServicesInput['services'],
        });
      } catch (error) {
        setSelected(previous);
        toast.error(getErrorMessage(error));
      }
    });
  };

  const disabled = !canEdit || pending;

  const serviceGroup = (
    group: keyof SurveyServices,
    title: string,
    options: ReadonlyArray<{ key: string; label: string }>,
  ) => (
    <fieldset className="space-y-2">
      <legend className={`text-xs ${workspaceTextMuted}`}>{title}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => {
          const id = `survey-service-${group}-${option.key}`;
          return (
            <div key={option.key} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={selected[group].includes(option.key)}
                disabled={disabled}
                onCheckedChange={() => toggleService(group, option.key)}
                data-test={id}
              />
              <Label htmlFor={id} className="text-sm font-normal">
                {option.label}
              </Label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <div
      className={`${workspacePanelCard} space-y-5 p-4 sm:p-5`}
      data-test="survey-accommodation-card"
    >
      <div>
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Accommodation and services
        </h3>
        <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
          Room counts per floor and the services present. These fill the
          accommodation table and service boxes in section C.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-24" />
              {ACCOMMODATION_ROOMS.map((room) => (
                <th
                  key={room.key}
                  scope="col"
                  className={`px-1 pb-2 text-center font-medium ${workspaceTextMuted}`}
                >
                  {room.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACCOMMODATION_FLOORS.map((floor) => (
              <tr key={floor.key}>
                <th
                  scope="row"
                  className="py-1 pr-2 text-left font-medium text-[var(--workspace-shell-text)]"
                >
                  {floor.label}
                </th>
                {ACCOMMODATION_ROOMS.map((room) => {
                  const value = counts[floor.key]?.[room.key] ?? 0;
                  return (
                    <td key={room.key} className="px-1 py-1 text-center">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={99}
                        aria-label={`${floor.label} ${room.label}`}
                        value={value > 0 ? value : ''}
                        disabled={disabled}
                        data-test={`survey-accommodation-${floor.key}-${room.key}`}
                        onChange={(event) => {
                          const parsed = Number.parseInt(
                            event.target.value,
                            10,
                          );
                          const count = Number.isFinite(parsed)
                            ? Math.min(99, Math.max(0, parsed))
                            : 0;
                          setCounts((prev) =>
                            withCount(prev, floor.key, room.key, count),
                          );
                        }}
                        onBlur={saveCounts}
                        className="h-8 w-12 rounded-md border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-center text-sm tabular-nums disabled:opacity-60"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {serviceGroup('main', 'Main services', MAIN_SERVICES)}
        {serviceGroup('heating', 'Central heating', CENTRAL_HEATING)}
      </div>
    </div>
  );
}
