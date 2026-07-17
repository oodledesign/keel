'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowLeft, Check, Copy, Pencil, Plus, X } from 'lucide-react';

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

import { publicBookUrl, publicEventBookUrl } from '../_lib/public-book-url';
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
  const [savedPage, setSavedPage] = useState(initialPage);
  const [eventTypes, setEventTypes] = useState(initialEventTypes);
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string | null>(
    initialEventTypes[0]?.id ?? null,
  );
  const [slugStatus, setSlugStatus] = useState<'idle' | 'ok' | 'taken'>('idle');
  const [editingPage, setEditingPage] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const selectedEventType = useMemo(
    () => eventTypes.find((item) => item.id === selectedEventTypeId) ?? null,
    [eventTypes, selectedEventTypeId],
  );

  const pageUrl = publicBookUrl(savedPage.slug);

  async function copyText(key: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      toast.success('Link copied');
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast.error('Could not copy link');
    }
  }

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
        setSavedPage(saved);
        setEditingPage(false);
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
        <h1 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
          {page.title}
        </h1>
        <Badge
          variant="outline"
          className={
            page.isActive
              ? 'rounded-full border-emerald-600/40 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'rounded-full'
          }
        >
          {page.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          className={`h-fit rounded-2xl border p-5 ${workspacePanelBorder}`}
        >
          {editingPage ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Edit page settings</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setPage(savedPage);
                    setEditingPage(false);
                    setSlugStatus('idle');
                  }}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Cancel</span>
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={page.title}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setPage((current) => ({
                        ...current,
                        title: e.target.value,
                      }))
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
                <div className="space-y-2">
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

              {canEdit ? (
                <Button
                  type="button"
                  className={`w-full ${workspaceBtnPrimaryMd}`}
                  disabled={pending || slugStatus === 'taken'}
                  onClick={savePage}
                >
                  Save page
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p
                    className={`text-xs font-medium tracking-wide uppercase ${workspaceTextMuted}`}
                  >
                    Page settings
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-[var(--workspace-shell-text)]">
                    {page.title}
                  </h2>
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setEditingPage(true)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                ) : null}
              </div>

              {page.description ? (
                <p className={`text-sm ${workspaceTextMuted}`}>
                  {page.description}
                </p>
              ) : null}

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className={`text-xs ${workspaceTextMuted}`}>
                    Public link
                  </dt>
                  <dd className="mt-1 break-all text-[var(--workspace-shell-text)]">
                    {pageUrl}
                  </dd>
                </div>
                <div>
                  <dt className={`text-xs ${workspaceTextMuted}`}>Timezone</dt>
                  <dd className="mt-1 text-[var(--workspace-shell-text)]">
                    {page.timezone}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className={`text-xs ${workspaceTextMuted}`}>Brand</dt>
                  <dd className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 rounded-full border border-[color:var(--workspace-shell-border)]"
                      style={{
                        backgroundColor: page.brandColour ?? '#FF5C34',
                      }}
                    />
                    <span className="text-[var(--workspace-shell-text)]">
                      {page.brandColour ?? '#FF5C34'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className={`text-xs ${workspaceTextMuted}`}>Status</dt>
                  <dd className="mt-1">
                    <Badge
                      variant="outline"
                      className={
                        page.isActive
                          ? 'rounded-full border-emerald-600/40 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'rounded-full'
                      }
                    >
                      {page.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </dd>
                </div>
              </dl>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full rounded-full"
                onClick={() => copyText('page', pageUrl)}
              >
                {copiedKey === 'page' ? (
                  <Check className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-2 h-3.5 w-3.5" />
                )}
                Copy page link
              </Button>
            </div>
          )}
        </aside>

        <section className="min-w-0 space-y-4">
          <div className={`rounded-2xl border p-4 ${workspacePanelBorder}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Event types</h2>
                <p className={`text-sm ${workspaceTextMuted}`}>
                  Meetings clients can book on this page.
                </p>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  className={`rounded-full ${workspaceBtnPrimaryMd}`}
                  onClick={addEventType}
                  disabled={pending}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add event type
                </Button>
              ) : null}
            </div>

            {eventTypes.length === 0 ? (
              <p
                className={`px-1 py-6 text-center text-sm ${workspaceTextMuted}`}
              >
                No event types yet. Add one to start taking bookings.
              </p>
            ) : (
              <ul className="space-y-1">
                {eventTypes.map((eventType) => {
                  const eventUrl = publicEventBookUrl(
                    savedPage.slug,
                    eventType.slug,
                  );
                  const isSelected = selectedEventTypeId === eventType.id;
                  return (
                    <li
                      key={eventType.id}
                      className={`flex items-center gap-1 rounded-xl ${
                        isSelected
                          ? 'bg-[var(--ozer-accent-subtle)]'
                          : 'hover:bg-[var(--workspace-shell-sidebar-accent)]'
                      }`}
                    >
                      <button
                        type="button"
                        className={`min-w-0 flex-1 px-3 py-2.5 text-left text-sm ${
                          isSelected
                            ? 'text-[var(--workspace-shell-accent-text)]'
                            : 'text-[var(--workspace-shell-text)]'
                        }`}
                        onClick={() => setSelectedEventTypeId(eventType.id)}
                      >
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {eventType.name}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
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
                        </span>
                        <span
                          className={`mt-0.5 block truncate text-xs ${workspaceTextMuted}`}
                        >
                          {eventType.defaultDuration} min · {eventUrl}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mr-1 h-8 w-8 shrink-0"
                        onClick={() => copyText(eventType.id, eventUrl)}
                        title="Copy event link"
                      >
                        {copiedKey === eventType.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span className="sr-only">Copy event link</span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selectedEventType ? (
            <EventTypeEditor
              key={selectedEventType.id}
              accountId={accountId}
              accountSlug={accountSlug}
              pageSlug={savedPage.slug}
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
        </section>
      </div>
    </div>
  );
}
