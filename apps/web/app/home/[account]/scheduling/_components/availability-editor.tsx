'use client';

import { useState, useTransition } from 'react';

import { Plus, Star, Trash2 } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import {
  workspaceBtnPrimaryMd,
  workspacePanelBorder,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  deleteAvailabilityScheduleAction,
  setDefaultAvailabilityScheduleAction,
  upsertAvailabilityScheduleAction,
} from '../_lib/server/scheduling-actions';
import type { AvailabilityScheduleRow } from '../_lib/server/scheduling.service';

const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

type DraftRule = {
  key: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type DraftOverride = {
  key: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  blocked: boolean;
};

type Props = {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  schedules: AvailabilityScheduleRow[];
};

function emptyWeekdayRules(): DraftRule[] {
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    key: `rule-${dayOfWeek}-0`,
    dayOfWeek,
    startTime: '09:00',
    endTime: '17:00',
  }));
}

export function AvailabilityEditor({
  accountId,
  accountSlug,
  canEdit,
  schedules: initialSchedules,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [schedules, setSchedules] = useState(initialSchedules);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSchedules[0]?.id ?? null,
  );
  const selected = schedules.find((s) => s.id === selectedId) ?? null;

  const [name, setName] = useState(selected?.name ?? 'Working hours');
  const [timezone, setTimezone] = useState(
    selected?.timezone ?? 'Europe/London',
  );
  const [isDefault, setIsDefault] = useState(selected?.isDefault ?? false);
  const [rules, setRules] = useState<DraftRule[]>(
    selected?.rules.map((rule, index) => ({
      key: rule.id || `rule-${index}`,
      dayOfWeek: rule.dayOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
    })) ?? emptyWeekdayRules(),
  );
  const [overrides, setOverrides] = useState<DraftOverride[]>(
    selected?.overrides.map((override) => ({
      key: override.id,
      date: override.date,
      startTime: override.startTime,
      endTime: override.endTime,
      blocked: override.startTime === null && override.endTime === null,
    })) ?? [],
  );

  function loadSchedule(schedule: AvailabilityScheduleRow | null) {
    setSelectedId(schedule?.id ?? null);
    setName(schedule?.name ?? 'Working hours');
    setTimezone(schedule?.timezone ?? 'Europe/London');
    setIsDefault(schedule?.isDefault ?? false);
    setRules(
      schedule?.rules.map((rule, index) => ({
        key: rule.id || `rule-${index}`,
        dayOfWeek: rule.dayOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
      })) ?? emptyWeekdayRules(),
    );
    setOverrides(
      schedule?.overrides.map((override) => ({
        key: override.id,
        date: override.date,
        startTime: override.startTime,
        endTime: override.endTime,
        blocked: override.startTime === null && override.endTime === null,
      })) ?? [],
    );
  }

  function save() {
    startTransition(async () => {
      try {
        const saved = await upsertAvailabilityScheduleAction({
          accountId,
          accountSlug,
          scheduleId: selectedId ?? undefined,
          name,
          timezone,
          isDefault,
          rules: rules.map((rule) => ({
            dayOfWeek: rule.dayOfWeek,
            startTime: rule.startTime,
            endTime: rule.endTime,
          })),
          overrides: overrides.map((override) => ({
            date: override.date,
            startTime: override.blocked ? null : override.startTime,
            endTime: override.blocked ? null : override.endTime,
          })),
        });
        setSchedules((current) => {
          const exists = current.some((item) => item.id === saved.id);
          return exists
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [...current, saved];
        });
        loadSchedule(saved);
        toast.success('Availability schedule saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save schedule',
        );
      }
    });
  }

  function createNew() {
    loadSchedule(null);
    setName('New schedule');
    setIsDefault(schedules.length === 0);
    setRules(emptyWeekdayRules());
    setOverrides([]);
  }

  function remove() {
    if (!selectedId) return;
    if (!window.confirm('Delete this availability schedule?')) return;
    startTransition(async () => {
      try {
        await deleteAvailabilityScheduleAction({
          accountId,
          accountSlug,
          scheduleId: selectedId,
        });
        const next = schedules.filter((item) => item.id !== selectedId);
        setSchedules(next);
        loadSchedule(next[0] ?? null);
        toast.success('Schedule deleted');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not delete schedule',
        );
      }
    });
  }

  function makeDefault(scheduleId: string) {
    startTransition(async () => {
      try {
        await setDefaultAvailabilityScheduleAction({
          accountId,
          accountSlug,
          scheduleId,
        });
        setSchedules((current) =>
          current.map((item) => ({
            ...item,
            isDefault: item.id === scheduleId,
          })),
        );
        if (selectedId === scheduleId) setIsDefault(true);
        toast.success('Default schedule updated');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update default',
        );
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className={`rounded-2xl border p-4 ${workspacePanelBorder}`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Schedules</h2>
          {canEdit ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full"
              onClick={createNew}
            >
              <Plus className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="space-y-1">
          {schedules.map((schedule) => (
            <button
              key={schedule.id}
              type="button"
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                selectedId === schedule.id
                  ? 'bg-[var(--ozer-accent-subtle)]'
                  : 'hover:bg-[var(--workspace-shell-sidebar-accent)]'
              }`}
              onClick={() => loadSchedule(schedule)}
            >
              <span className="truncate">{schedule.name}</span>
              {schedule.isDefault ? (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  Default
                </Badge>
              ) : null}
            </button>
          ))}
        </div>
      </aside>

      <section
        className={`space-y-5 rounded-2xl border p-5 ${workspacePanelBorder}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">
              {selectedId ? 'Edit schedule' : 'New schedule'}
            </h2>
            <p className={`text-sm ${workspaceTextMuted}`}>
              Weekly hours plus date overrides for holidays or custom days.
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {selectedId ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={pending || isDefault}
                    onClick={() => makeDefault(selectedId)}
                  >
                    <Star className="mr-2 h-3.5 w-3.5" />
                    Make default
                  </Button>
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
                </>
              ) : null}
              <Button
                type="button"
                className={workspaceBtnPrimaryMd}
                disabled={pending}
                onClick={save}
              >
                Save schedule
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              disabled={!canEdit}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select
              value={timezone}
              disabled={!canEdit}
              onValueChange={setTimezone}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  'Europe/London',
                  'Europe/Paris',
                  'America/New_York',
                  'America/Los_Angeles',
                  'UTC',
                ].map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={isDefault}
              disabled={!canEdit}
              onCheckedChange={setIsDefault}
            />
            <Label>Default schedule for new event types</Label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Weekly hours</h3>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() =>
                  setRules((current) => [
                    ...current,
                    {
                      key: `rule-${Date.now()}`,
                      dayOfWeek: 1,
                      startTime: '09:00',
                      endTime: '17:00',
                    },
                  ])
                }
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add range
              </Button>
            ) : null}
          </div>
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.key}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-xl border border-[color:var(--workspace-shell-border)] p-2"
              >
                <Select
                  value={String(rule.dayOfWeek)}
                  disabled={!canEdit}
                  onValueChange={(value) =>
                    setRules((current) =>
                      current.map((item) =>
                        item.key === rule.key
                          ? { ...item, dayOfWeek: Number(value) }
                          : item,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_LABELS.map((label, index) => (
                      <SelectItem key={label} value={String(index)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="time"
                  disabled={!canEdit}
                  value={rule.startTime}
                  onChange={(e) =>
                    setRules((current) =>
                      current.map((item) =>
                        item.key === rule.key
                          ? { ...item, startTime: e.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <Input
                  type="time"
                  disabled={!canEdit}
                  value={rule.endTime}
                  onChange={(e) =>
                    setRules((current) =>
                      current.map((item) =>
                        item.key === rule.key
                          ? { ...item, endTime: e.target.value }
                          : item,
                      ),
                    )
                  }
                />
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setRules((current) =>
                        current.filter((item) => item.key !== rule.key),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Date overrides</h3>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() =>
                  setOverrides((current) => [
                    ...current,
                    {
                      key: `override-${Date.now()}`,
                      date: new Date().toISOString().slice(0, 10),
                      startTime: null,
                      endTime: null,
                      blocked: true,
                    },
                  ])
                }
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add override
              </Button>
            ) : null}
          </div>
          {overrides.length === 0 ? (
            <p className={`text-sm ${workspaceTextMuted}`}>
              No overrides. Block a holiday or set custom hours for a date.
            </p>
          ) : (
            <div className="space-y-2">
              {overrides.map((override) => (
                <div
                  key={override.key}
                  className="space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      disabled={!canEdit}
                      value={override.date}
                      onChange={(e) =>
                        setOverrides((current) =>
                          current.map((item) =>
                            item.key === override.key
                              ? { ...item, date: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={override.blocked}
                        disabled={!canEdit}
                        onCheckedChange={(blocked) =>
                          setOverrides((current) =>
                            current.map((item) =>
                              item.key === override.key
                                ? {
                                    ...item,
                                    blocked,
                                    startTime: blocked ? null : '09:00',
                                    endTime: blocked ? null : '17:00',
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      <Label>Unavailable all day</Label>
                    </div>
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto"
                        onClick={() =>
                          setOverrides((current) =>
                            current.filter((item) => item.key !== override.key),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  {!override.blocked ? (
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        disabled={!canEdit}
                        value={override.startTime ?? '09:00'}
                        onChange={(e) =>
                          setOverrides((current) =>
                            current.map((item) =>
                              item.key === override.key
                                ? { ...item, startTime: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <Input
                        type="time"
                        disabled={!canEdit}
                        value={override.endTime ?? '17:00'}
                        onChange={(e) =>
                          setOverrides((current) =>
                            current.map((item) =>
                              item.key === override.key
                                ? { ...item, endTime: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
