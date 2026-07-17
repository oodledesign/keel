'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  CalendarPlus,
  ChevronRight,
  Layers,
  MapPin,
  Users,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
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

import { WorkspaceRichTextEditor } from '~/components/workspace-rich-text';
import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type {
  GroupMemberOption,
  MeetupListRow,
  MeetupSeriesOption,
  MeetupTemplate,
} from '../_lib/community-schedule.types';
import { createCommunityMeetup } from '../_lib/server/community-schedule.actions';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_12px_36px_rgba(4,10,24,0.18)]';

type Props = {
  accountSlug: string;
  accountId: string;
  upcoming: MeetupListRow[];
  past: MeetupListRow[];
  series: MeetupSeriesOption[];
  templates: MeetupTemplate[];
  members: GroupMemberOption[];
  tablesReady: boolean;
};

function meetupPath(accountSlug: string, eventId: string) {
  return pathsConfig.app.accountCommunityMeetupDetail
    .replace('[account]', accountSlug)
    .replace('[eventId]', eventId);
}

export function CommunitySchedulePageContent({
  accountSlug,
  accountId,
  upcoming,
  past,
  series,
  templates,
  members,
  tablesReady,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(
    searchParams.get('create') === 'session',
  );
  const [templateId, setTemplateId] = useState('none');
  const [seriesId, setSeriesId] = useState('none');
  const [sessionNotesHtml, setSessionNotesHtml] = useState('');
  const [isPending, startTransition] = useTransition();

  const defaultStarts = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7) + 7);
    d.setHours(19, 30, 0, 0);
    return d.toISOString().slice(0, 16);
  }, []);

  if (!tablesReady) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-6 text-sm text-amber-100/90">
        Community schedule tables are not on this database yet. Run{' '}
        <code className="text-amber-200">pnpm supabase db push</code> to apply
        the latest migrations, then refresh.
      </div>
    );
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = (form.get('title') as string).trim();
    const startsAt = (form.get('startsAt') as string).trim();
    if (!title || !startsAt) {
      toast.error('Title and date/time are required');
      return;
    }

    const tpl = templateId !== 'none' ? templateId : null;
    const ser = seriesId !== 'none' ? seriesId : null;
    const seriesLabel = (form.get('seriesLabel') as string).trim() || null;
    const attendeeIds = members
      .filter((m) => form.get(`att_${m.userId}`) === 'on')
      .map((m) => m.userId);

    startTransition(async () => {
      try {
        const result = await createCommunityMeetup({
          accountId,
          accountSlug,
          title,
          startsAt: new Date(startsAt).toISOString(),
          location: (form.get('location') as string).trim() || null,
          sessionNotes: sessionNotesHtml.trim() || null,
          templateId: tpl,
          seriesId: ser,
          seriesLabel,
          attendeeUserIds: attendeeIds,
        });
        toast.success('Meetup scheduled');
        setCreateOpen(false);
        router.push(meetupPath(accountSlug, result.eventId));
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not create meetup',
        );
      }
    });
  }

  return (
    <div className="space-y-8 text-[var(--workspace-shell-text)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Upcoming meetups</h2>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            Plan sessions, attach content, and record what happened afterwards.
          </p>
        </div>
        <Button
          type="button"
          className={workspaceBtnPrimaryMd}
          onClick={() => setCreateOpen(true)}
        >
          <CalendarPlus className="h-4 w-4" />
          Schedule meetup
        </Button>
      </div>

      <MeetupSection
        title="Coming up"
        rows={upcoming}
        accountSlug={accountSlug}
        emptyMessage="No upcoming meetups yet. Schedule your next group session."
      />

      {past.length > 0 ? (
        <MeetupSection
          title="Past meetups"
          rows={past}
          accountSlug={accountSlug}
          muted
        />
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule a meetup</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                name="title"
                placeholder="Home group — Acts study"
                required
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date & time</Label>
                <Input
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={defaultStarts}
                  required
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  name="location"
                  placeholder="42 Oak Street"
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
                />
              </div>
            </div>
            {templates.length > 0 ? (
              <div className="space-y-2">
                <Label>Template (optional)</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
                    <SelectValue placeholder="No template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No template</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Series</Label>
                <Select value={seriesId} onValueChange={setSeriesId}>
                  <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]">
                    <SelectValue
                      placeholder={
                        series.length ? 'Choose series' : 'No series yet'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standalone meetup</SelectItem>
                    {series.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Session in series (optional)</Label>
                <Input
                  name="seriesLabel"
                  placeholder="Week 3 · Chapter 5"
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Agenda preview</Label>
              <WorkspaceRichTextEditor
                value={sessionNotesHtml}
                onChange={setSessionNotesHtml}
                placeholder="Welcome, worship, discussion…"
                minHeight={100}
              />
            </div>
            {members.length > 0 ? (
              <div className="space-y-2">
                <Label>Who&apos;s attending?</Label>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
                  {members.map((m) => (
                    <label
                      key={m.userId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name={`att_${m.userId}`}
                        className="rounded border-[color:var(--workspace-shell-border)]"
                      />
                      {m.displayName}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)]"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className={workspaceBtnPrimaryMd}
              >
                {isPending ? 'Creating…' : 'Create meetup'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MeetupSection({
  title,
  rows,
  accountSlug,
  emptyMessage,
  muted,
}: {
  title: string;
  rows: MeetupListRow[];
  accountSlug: string;
  emptyMessage?: string;
  muted?: boolean;
}) {
  return (
    <section className={panelClass}>
      <div className="border-b border-[color:var(--workspace-shell-border)] px-5 py-4">
        <h3 className="text-sm font-semibold tracking-wide text-amber-200/80 uppercase">
          {title}
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-[var(--workspace-shell-text)]/50">
          {emptyMessage}
        </p>
      ) : (
        <ul className="divide-y divide-white/6">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={meetupPath(accountSlug, row.id)}
                className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] ${muted ? 'opacity-80' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[var(--workspace-shell-text)]">
                      {row.title}
                    </p>
                    {row.seriesName ? (
                      <Badge
                        variant="outline"
                        className="border-amber-400/30 text-amber-200/90"
                      >
                        <Layers className="mr-1 h-3 w-3" />
                        {row.seriesName}
                        {row.seriesLabel ? ` · ${row.seriesLabel}` : ''}
                      </Badge>
                    ) : row.seriesLabel ? (
                      <Badge
                        variant="outline"
                        className="border-amber-400/30 text-amber-200/90"
                      >
                        {row.seriesLabel}
                      </Badge>
                    ) : null}
                    {row.status === 'completed' ? (
                      <Badge className="bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)]">
                        Completed
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/60">
                    {row.dateLabel} · {row.timeLabel}
                    {row.location ? (
                      <>
                        {' '}
                        · <MapPin className="mr-0.5 inline h-3 w-3" />
                        {row.location}
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--workspace-shell-text)]/50">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {row.attendeeCount}
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
