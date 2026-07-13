'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowLeft, Plus } from 'lucide-react';

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
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';
import {
  workspaceBtnPrimaryMd,
  workspacePanelBorder,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { publicBookUrl } from '../_lib/public-book-url';
import {
  checkBookingPageSlugAction,
  createEventTypeAction,
  deleteEventTypeAction,
  saveFormFieldsAction,
  updateBookingPageAction,
  updateEventTypeAction,
} from '../_lib/server/scheduling-actions';
import type {
  AvailabilityScheduleRow,
  BookingPageRow,
  ConferencingConnectionRow,
  EventTypeRow,
  FormFieldRow,
} from '../_lib/server/scheduling.service';
import { EventTypeEditor } from './event-type-editor';

const TIMEZONES = [
  'Europe/London',
  'Europe/Paris',
  'Europe/Dublin',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
];

type Props = {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  page: BookingPageRow;
  eventTypes: EventTypeRow[];
  schedules: AvailabilityScheduleRow[];
  formFieldsByEventType: Record<string, FormFieldRow[]>;
  conferencing: ConferencingConnectionRow[];
};

export function BookingPageEditor({
  accountId,
  accountSlug,
  canEdit,
  page: initialPage,
  eventTypes: initialEventTypes,
  schedules,
  formFieldsByEventType,
  conferencing,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [page, setPage] = useState(initialPage);
  const [eventTypes, setEventTypes] = useState(initialEventTypes);
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string | null>(
    initialEventTypes[0]?.id ?? null,
  );
  const [slugStatus, setSlugStatus] = useState<'idle' | 'ok' | 'taken'>('idle');

  const selectedEventType = useMemo(
    () => eventTypes.find((item) => item.id === selectedEventTypeId) ?? null,
    [eventTypes, selectedEventTypeId],
  );

  function savePage() {
    startTransition(async () => {
      try {
        const saved = await updateBookingPageAction({
          accountId,
          accountSlug,
          pageId: page.id,
          title: page.title,
          description: page.description,
          slug: page.slug,
          timezone: page.timezone,
          brandColour: page.brandColour,
          isActive: page.isActive,
        });
        setPage(saved);
        toast.success('Booking page saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save page',
        );
      }
    });
  }

  function checkSlug(slug: string) {
    startTransition(async () => {
      try {
        const result = await checkBookingPageSlugAction({
          accountId,
          slug,
          excludePageId: page.id,
        });
        setSlugStatus(result.available ? 'ok' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    });
  }

  function addEventType() {
    const defaultSchedule =
      schedules.find((s) => s.isDefault) ?? schedules[0] ?? null;
    if (!defaultSchedule) {
      toast.error('Create an availability schedule first');
      return;
    }

    startTransition(async () => {
      try {
        const created = await createEventTypeAction({
          accountId,
          accountSlug,
          bookingPageId: page.id,
          name: 'New meeting',
          slug: `meeting-${Date.now().toString(36)}`,
          description: null,
          durations: [30],
          defaultDuration: 30,
          locationType: 'google_meet',
          locationDetail: null,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          minimumNoticeMinutes: 240,
          bookingWindowDays: 60,
          maxBookingsPerDay: null,
          slotIncrementMinutes: 30,
          allowGuestInvites: true,
          availabilityScheduleId: defaultSchedule.id,
          isActive: true,
          isPrivate: false,
        });
        setEventTypes((current) => [...current, created]);
        setSelectedEventTypeId(created.id);
        toast.success('Event type created');
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not create event type',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link
            href={pathsConfig.app.accountScheduling.replace(
              '[account]',
              accountSlug,
            )}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            All pages
          </Link>
        </Button>
        <Badge variant="outline" className="rounded-full">
          {publicBookUrl(page.slug)}
        </Badge>
      </div>

      <section
        className={`space-y-4 rounded-2xl border p-5 ${workspacePanelBorder}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Page settings</h2>
          {canEdit ? (
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={pending || slugStatus === 'taken'}
              onClick={savePage}
            >
              Save page
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={page.title}
              disabled={!canEdit}
              onChange={(e) =>
                setPage((current) => ({ ...current, title: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input
              value={page.slug}
              disabled={!canEdit}
              onChange={(e) => {
                const slug = e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, '');
                setPage((current) => ({ ...current, slug }));
                checkSlug(slug);
              }}
            />
            <p className={`text-xs ${workspaceTextMuted}`}>
              {slugStatus === 'ok'
                ? 'Slug is available'
                : slugStatus === 'taken'
                  ? 'Slug is already taken'
                  : publicBookUrl(page.slug)}
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={page.description ?? ''}
              disabled={!canEdit}
              rows={3}
              onChange={(e) =>
                setPage((current) => ({
                  ...current,
                  description: e.target.value || null,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select
              value={page.timezone}
              disabled={!canEdit}
              onValueChange={(timezone) =>
                setPage((current) => ({ ...current, timezone }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Brand colour</Label>
            <Input
              type="color"
              disabled={!canEdit}
              value={page.brandColour ?? '#FF5C34'}
              className="h-10 cursor-pointer p-1"
              onChange={(e) =>
                setPage((current) => ({
                  ...current,
                  brandColour: e.target.value,
                }))
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={page.isActive}
              disabled={!canEdit}
              onCheckedChange={(isActive) =>
                setPage((current) => ({ ...current, isActive }))
              }
            />
            <Label>Page is active</Label>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className={`rounded-2xl border p-4 ${workspacePanelBorder}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Event types</h3>
            {canEdit ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full"
                onClick={addEventType}
                disabled={pending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <div className="space-y-1">
            {eventTypes.map((eventType) => (
              <button
                key={eventType.id}
                type="button"
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                  selectedEventTypeId === eventType.id
                    ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                    : 'hover:bg-[var(--workspace-shell-sidebar-accent)]'
                }`}
                onClick={() => setSelectedEventTypeId(eventType.id)}
              >
                <span className="truncate">{eventType.name}</span>
                <span className="ml-2 flex shrink-0 items-center gap-1">
                  {eventType.isPrivate ? (
                    <Badge
                      variant="outline"
                      className="rounded-full text-[10px]"
                    >
                      Private
                    </Badge>
                  ) : null}
                  {!eventType.isActive ? (
                    <Badge
                      variant="outline"
                      className="rounded-full text-[10px]"
                    >
                      Off
                    </Badge>
                  ) : null}
                </span>
              </button>
            ))}
            {eventTypes.length === 0 ? (
              <p className={`px-1 text-xs ${workspaceTextMuted}`}>
                No event types yet.
              </p>
            ) : null}
          </div>
        </div>

        <div>
          {selectedEventType ? (
            <EventTypeEditor
              key={selectedEventType.id}
              accountId={accountId}
              accountSlug={accountSlug}
              pageSlug={page.slug}
              canEdit={canEdit}
              eventType={selectedEventType}
              schedules={schedules}
              formFields={formFieldsByEventType[selectedEventType.id] ?? []}
              conferencing={conferencing}
              onSaved={(saved) => {
                setEventTypes((current) =>
                  current.map((item) => (item.id === saved.id ? saved : item)),
                );
              }}
              onDeleted={(id) => {
                setEventTypes((current) =>
                  current.filter((item) => item.id !== id),
                );
                setSelectedEventTypeId((current) =>
                  current === id
                    ? (eventTypes.find((item) => item.id !== id)?.id ?? null)
                    : current,
                );
                router.refresh();
              }}
              onSave={async (input) => {
                return updateEventTypeAction({
                  accountId,
                  accountSlug,
                  eventTypeId: selectedEventType.id,
                  ...input,
                });
              }}
              onDelete={async () => {
                await deleteEventTypeAction({
                  accountId,
                  accountSlug,
                  eventTypeId: selectedEventType.id,
                });
              }}
              onSaveFields={async (fields) => {
                return saveFormFieldsAction({
                  accountId,
                  accountSlug,
                  eventTypeId: selectedEventType.id,
                  fields,
                });
              }}
            />
          ) : (
            <div
              className={`rounded-2xl border border-dashed p-10 text-center ${workspacePanelBorder}`}
            >
              <p className={`text-sm ${workspaceTextMuted}`}>
                Select or create an event type to configure durations, location,
                and intake questions.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
