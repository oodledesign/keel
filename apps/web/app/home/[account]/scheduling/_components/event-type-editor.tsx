'use client';

import { useState, useTransition } from 'react';

import { GripVertical, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import {
  workspaceBtnPrimaryMd,
  workspacePanelBorder,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type {
  FormFieldType,
  LocationType,
} from '../_lib/schema/scheduling.schema';
import type {
  AvailabilityScheduleRow,
  ConferencingConnectionRow,
  EventTypeRow,
  FormFieldRow,
} from '../_lib/server/scheduling.service';

const LOCATION_OPTIONS: Array<{ value: LocationType; label: string }> = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'phone', label: 'Phone' },
  { value: 'in_person', label: 'In person' },
  { value: 'custom', label: 'Custom' },
];

const FIELD_TYPES: Array<{ value: FormFieldType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Select' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
];

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

type EventTypeInput = {
  name: string;
  slug: string;
  description: string | null;
  durations: number[];
  defaultDuration: number;
  locationType: LocationType;
  locationDetail: string | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeMinutes: number;
  bookingWindowDays: number;
  maxBookingsPerDay: number | null;
  slotIncrementMinutes: number;
  allowGuestInvites: boolean;
  availabilityScheduleId: string;
  isActive: boolean;
};

type DraftField = {
  key: string;
  id?: string;
  label: string;
  fieldType: FormFieldType;
  options: string[];
  isRequired: boolean;
  sortOrder: number;
};

type Props = {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  eventType: EventTypeRow;
  schedules: AvailabilityScheduleRow[];
  formFields: FormFieldRow[];
  conferencing: ConferencingConnectionRow[];
  onSave: (input: EventTypeInput) => Promise<EventTypeRow>;
  onDelete: () => Promise<void>;
  onSaveFields: (
    fields: Array<{
      id?: string;
      label: string;
      fieldType: FormFieldType;
      options: string[] | null;
      isRequired: boolean;
      sortOrder: number;
    }>,
  ) => Promise<FormFieldRow[]>;
  onSaved: (eventType: EventTypeRow) => void;
  onDeleted: (id: string) => void;
};

export function EventTypeEditor({
  canEdit,
  eventType,
  schedules,
  formFields,
  conferencing,
  onSave,
  onDelete,
  onSaveFields,
  onSaved,
  onDeleted,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<EventTypeInput>({
    name: eventType.name,
    slug: eventType.slug,
    description: eventType.description,
    durations: eventType.durations,
    defaultDuration: eventType.defaultDuration,
    locationType: eventType.locationType,
    locationDetail: eventType.locationDetail,
    bufferBeforeMinutes: eventType.bufferBeforeMinutes,
    bufferAfterMinutes: eventType.bufferAfterMinutes,
    minimumNoticeMinutes: eventType.minimumNoticeMinutes,
    bookingWindowDays: eventType.bookingWindowDays,
    maxBookingsPerDay: eventType.maxBookingsPerDay,
    slotIncrementMinutes: eventType.slotIncrementMinutes,
    allowGuestInvites: eventType.allowGuestInvites,
    availabilityScheduleId: eventType.availabilityScheduleId,
    isActive: eventType.isActive,
  });

  const [fields, setFields] = useState<DraftField[]>(
    formFields.map((field, index) => ({
      key: field.id,
      id: field.id,
      label: field.label,
      fieldType: field.fieldType as FormFieldType,
      options: field.options ?? [],
      isRequired: field.isRequired,
      sortOrder: field.sortOrder ?? index,
    })),
  );

  const zoomConnected = conferencing.some((c) => c.provider === 'zoom');
  const teamsConnected = conferencing.some((c) => c.provider === 'teams');
  const needsConferencingHint =
    (draft.locationType === 'zoom' && !zoomConnected) ||
    (draft.locationType === 'teams' && !teamsConnected);

  function toggleDuration(minutes: number, checked: boolean) {
    setDraft((current) => {
      const durations = checked
        ? [...new Set([...current.durations, minutes])].sort((a, b) => a - b)
        : current.durations.filter((value) => value !== minutes);
      const defaultDuration = durations.includes(current.defaultDuration)
        ? current.defaultDuration
        : (durations[0] ?? 30);
      return {
        ...current,
        durations: durations.length > 0 ? durations : [30],
        defaultDuration,
      };
    });
  }

  function save() {
    startTransition(async () => {
      try {
        const saved = await onSave(draft);
        const savedFields = await onSaveFields(
          fields.map((field, index) => ({
            id: field.id,
            label: field.label,
            fieldType: field.fieldType,
            options:
              field.fieldType === 'select' || field.fieldType === 'multiselect'
                ? field.options
                : null,
            isRequired: field.isRequired,
            sortOrder: index,
          })),
        );
        setFields(
          savedFields.map((field, index) => ({
            key: field.id,
            id: field.id,
            label: field.label,
            fieldType: field.fieldType as FormFieldType,
            options: field.options ?? [],
            isRequired: field.isRequired,
            sortOrder: field.sortOrder ?? index,
          })),
        );
        onSaved(saved);
        toast.success('Event type saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save event type',
        );
      }
    });
  }

  function remove() {
    if (!window.confirm(`Delete “${draft.name}”?`)) return;
    startTransition(async () => {
      try {
        await onDelete();
        onDeleted(eventType.id);
        toast.success('Event type deleted');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not delete event type',
        );
      }
    });
  }

  return (
    <div className={`space-y-6 rounded-2xl border p-5 ${workspacePanelBorder}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{draft.name || 'Event type'}</h3>
        {canEdit ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={pending}
              onClick={remove}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </Button>
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={pending}
              onClick={save}
            >
              Save event type
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            disabled={!canEdit}
            value={draft.name}
            onChange={(e) =>
              setDraft((current) => ({ ...current, name: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input
            disabled={!canEdit}
            value={draft.slug}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                slug: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, ''),
              }))
            }
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Description</Label>
          <Textarea
            disabled={!canEdit}
            rows={2}
            value={draft.description ?? ''}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                description: e.target.value || null,
              }))
            }
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Durations (minutes)</Label>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((minutes) => {
            const checked = draft.durations.includes(minutes);
            return (
              <label
                key={minutes}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                  checked
                    ? 'border-[var(--ozer-accent)]/40 bg-[var(--ozer-accent-subtle)]'
                    : 'border-[color:var(--workspace-shell-border)]'
                }`}
              >
                <Checkbox
                  checked={checked}
                  disabled={!canEdit}
                  onCheckedChange={(value) =>
                    toggleDuration(minutes, value === true)
                  }
                />
                {minutes}m
              </label>
            );
          })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default duration</Label>
            <Select
              value={String(draft.defaultDuration)}
              disabled={!canEdit}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  defaultDuration: Number(value),
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {draft.durations.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {minutes} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Slot increment</Label>
            <Input
              type="number"
              disabled={!canEdit}
              value={draft.slotIncrementMinutes}
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  slotIncrementMinutes: Number(e.target.value) || 30,
                }))
              }
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Location</Label>
          <Select
            value={draft.locationType}
            disabled={!canEdit}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                locationType: value as LocationType,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {needsConferencingHint ? (
            <p className="text-xs text-[var(--ozer-coral-400)]">
              Connect {draft.locationType === 'zoom' ? 'Zoom' : 'Teams'} under
              Connected accounts before invitees can join automatically.
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Location detail</Label>
          <Input
            disabled={!canEdit}
            placeholder="Address or dial-in notes"
            value={draft.locationDetail ?? ''}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                locationDetail: e.target.value || null,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Availability schedule</Label>
          <Select
            value={draft.availabilityScheduleId}
            disabled={!canEdit || schedules.length === 0}
            onValueChange={(availabilityScheduleId) =>
              setDraft((current) => ({ ...current, availabilityScheduleId }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a schedule" />
            </SelectTrigger>
            <SelectContent>
              {schedules.map((schedule) => (
                <SelectItem key={schedule.id} value={schedule.id}>
                  {schedule.name}
                  {schedule.isDefault ? ' (default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NumberField
          label="Buffer before (min)"
          value={draft.bufferBeforeMinutes}
          disabled={!canEdit}
          onChange={(bufferBeforeMinutes) =>
            setDraft((current) => ({ ...current, bufferBeforeMinutes }))
          }
        />
        <NumberField
          label="Buffer after (min)"
          value={draft.bufferAfterMinutes}
          disabled={!canEdit}
          onChange={(bufferAfterMinutes) =>
            setDraft((current) => ({ ...current, bufferAfterMinutes }))
          }
        />
        <NumberField
          label="Minimum notice (min)"
          value={draft.minimumNoticeMinutes}
          disabled={!canEdit}
          onChange={(minimumNoticeMinutes) =>
            setDraft((current) => ({ ...current, minimumNoticeMinutes }))
          }
        />
        <NumberField
          label="Booking window (days)"
          value={draft.bookingWindowDays}
          disabled={!canEdit}
          onChange={(bookingWindowDays) =>
            setDraft((current) => ({ ...current, bookingWindowDays }))
          }
        />
        <div className="space-y-2">
          <Label>Max bookings / day</Label>
          <Input
            type="number"
            disabled={!canEdit}
            placeholder="No cap"
            value={draft.maxBookingsPerDay ?? ''}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                maxBookingsPerDay: e.target.value
                  ? Number(e.target.value)
                  : null,
              }))
            }
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            checked={draft.allowGuestInvites}
            disabled={!canEdit}
            onCheckedChange={(allowGuestInvites) =>
              setDraft((current) => ({ ...current, allowGuestInvites }))
            }
          />
          <Label>Allow guest invites</Label>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            checked={draft.isActive}
            disabled={!canEdit}
            onCheckedChange={(isActive) =>
              setDraft((current) => ({ ...current, isActive }))
            }
          />
          <Label>Event type active</Label>
        </div>
      </div>

      <div className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Custom form fields</h4>
            <p className={`text-xs ${workspaceTextMuted}`}>
              Name and email are always collected and are not listed here.
            </p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() =>
                setFields((current) => [
                  ...current,
                  {
                    key: `new-${Date.now()}`,
                    label: 'New question',
                    fieldType: 'text',
                    options: [],
                    isRequired: false,
                    sortOrder: current.length,
                  },
                ])
              }
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add field
            </Button>
          ) : null}
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.key}
              className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3"
            >
              <div className="mb-3 flex items-center gap-2 text-[var(--workspace-shell-text-muted)]">
                <GripVertical className="h-4 w-4" />
                <span className="text-xs">Field {index + 1}</span>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-7 w-7"
                    onClick={() =>
                      setFields((current) =>
                        current.filter((item) => item.key !== field.key),
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label>Label</Label>
                  <Input
                    disabled={!canEdit}
                    value={field.label}
                    onChange={(e) =>
                      setFields((current) =>
                        current.map((item) =>
                          item.key === field.key
                            ? { ...item, label: e.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={field.fieldType}
                    disabled={!canEdit}
                    onValueChange={(value) =>
                      setFields((current) =>
                        current.map((item) =>
                          item.key === field.key
                            ? { ...item, fieldType: value as FormFieldType }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(field.fieldType === 'select' ||
                field.fieldType === 'multiselect') && (
                <div className="mt-3 space-y-2">
                  <Label>Options (comma-separated)</Label>
                  <Input
                    disabled={!canEdit}
                    value={field.options.join(', ')}
                    onChange={(e) =>
                      setFields((current) =>
                        current.map((item) =>
                          item.key === field.key
                            ? {
                                ...item,
                                options: e.target.value
                                  .split(',')
                                  .map((part) => part.trim())
                                  .filter(Boolean),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Switch
                  checked={field.isRequired}
                  disabled={!canEdit}
                  onCheckedChange={(isRequired) =>
                    setFields((current) =>
                      current.map((item) =>
                        item.key === field.key
                          ? { ...item, isRequired }
                          : item,
                      ),
                    )
                  }
                />
                <Label>Required</Label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}
