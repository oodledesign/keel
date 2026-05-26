'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';

import { ArrowLeft, Plus, Sparkles, Trash2 } from 'lucide-react';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { toast } from '@kit/ui/sonner';

import { YoutubeEmbed } from '~/components/youtube-embed';
import { WorkspaceRichTextEditor } from '~/components/workspace-rich-text';
import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import {
  addMeetupContentItem,
  deleteMeetupContentItem,
  saveMeetupRecord,
  saveMeetupTemplate,
  setMeetupAttendees,
  summarizeMeetupRecord,
  updateCommunityMeetup,
} from '../_lib/server/community-schedule.actions';
import { MeetupContentItemView } from './meetup-content-item-view';
import type {
  EveningPart,
  MeetupDetail,
  MeetupSeriesOption,
} from '../_lib/community-schedule.types';

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] p-5';

function isoToDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

type Props = {
  accountSlug: string;
  detail: MeetupDetail;
  series: MeetupSeriesOption[];
};

export function CommunityMeetupDetailClient({
  accountSlug,
  detail,
  series,
}: Props) {
  const schedulePath = pathsConfig.app.accountCommunitySchedule.replace(
    '[account]',
    accountSlug,
  );
  const [tab, setTab] = useState('plan');
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(detail.title);
  const [startsAt, setStartsAt] = useState(() => isoToDatetimeLocal(detail.startsAt));
  const [location, setLocation] = useState(detail.location ?? '');
  const [seriesId, setSeriesId] = useState(detail.seriesId ?? 'none');
  const [seriesLabel, setSeriesLabel] = useState(detail.seriesLabel ?? '');
  const [sessionNotes, setSessionNotes] = useState(detail.sessionNotes ?? '');
  const [mealPlan, setMealPlan] = useState(detail.mealPlan ?? '');
  const [eveningParts, setEveningParts] = useState<EveningPart[]>(
    detail.eveningParts.length > 0
      ? detail.eveningParts
      : [
          { id: 'welcome', title: 'Welcome', notes: '' },
          { id: 'discussion', title: 'Discussion', notes: '' },
          { id: 'prayer', title: 'Prayer', notes: '' },
        ],
  );
  const [attending, setAttending] = useState<Set<string>>(
    new Set(
      detail.attendees.filter((a) => a.status === 'going').map((a) => a.userId),
    ),
  );

  const [transcript, setTranscript] = useState(detail.record?.transcript ?? '');
  const [reflection, setReflection] = useState(
    detail.record?.reflectionNotes ?? '',
  );
  const [aiSummary, setAiSummary] = useState(detail.record?.aiSummary ?? '');

  const [newContentKind, setNewContentKind] = useState<
    'richtext' | 'link' | 'youtube' | 'video'
  >('link');
  const [newContentTitle, setNewContentTitle] = useState('');
  const [newContentUrl, setNewContentUrl] = useState('');
  const [newContentBody, setNewContentBody] = useState('');

  function savePlan() {
    startTransition(async () => {
      try {
        await updateCommunityMeetup({
          accountId: detail.accountId,
          accountSlug,
          eventId: detail.id,
          title,
          startsAt: new Date(startsAt).toISOString(),
          location,
          seriesId: seriesId === 'none' ? null : seriesId,
          seriesLabel: seriesLabel.trim() || null,
          sessionNotes,
          mealPlan,
          eveningParts,
        });
        await setMeetupAttendees({
          accountId: detail.accountId,
          accountSlug,
          eventId: detail.id,
          attendeeUserIds: [...attending],
        });
        toast.success('Meetup saved');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  function saveRecord() {
    startTransition(async () => {
      try {
        await saveMeetupRecord({
          accountId: detail.accountId,
          accountSlug,
          eventId: detail.id,
          transcript,
          reflectionNotes: reflection,
        });
        toast.success('Record saved');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  function runSummary() {
    if (transcript.trim().length < 20) {
      toast.error('Add a longer transcript or notes first');
      return;
    }
    startTransition(async () => {
      try {
        const { summary } = await summarizeMeetupRecord({
          accountId: detail.accountId,
          accountSlug,
          eventId: detail.id,
          meetupTitle: title,
          transcript,
        });
        setAiSummary(summary);
        toast.success('Summary generated');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Summary failed');
      }
    });
  }

  function addContent() {
    startTransition(async () => {
      try {
        await addMeetupContentItem({
          accountId: detail.accountId,
          accountSlug,
          eventId: detail.id,
          kind: newContentKind,
          title: newContentTitle || 'Content',
          body: newContentBody || null,
          url: newContentUrl || null,
        });
        setNewContentTitle('');
        setNewContentUrl('');
        setNewContentBody('');
        toast.success('Content added');
        window.location.reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not add content');
      }
    });
  }

  function saveAsTemplate() {
    const name = window.prompt('Template name');
    if (!name?.trim()) return;
    startTransition(async () => {
      try {
        await saveMeetupTemplate({
          accountId: detail.accountId,
          accountSlug,
          name: name.trim(),
          defaultTitle: title,
          mealPlan,
          eveningParts,
          contentItems: detail.contentItems.map((c) => ({
            kind: c.kind,
            title: c.title,
            body: c.body,
            url: c.url,
          })),
        });
        toast.success('Template saved');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save template');
      }
    });
  }

  const startsDisplay = new Date(detail.startsAt).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={schedulePath}
          className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Schedule
        </Link>
        {detail.seriesName || detail.seriesLabel ? (
          <Badge variant="outline" className="border-amber-400/30 text-amber-200">
            {detail.seriesName}
            {detail.seriesLabel ? ` · ${detail.seriesLabel}` : ''}
          </Badge>
        ) : null}
      </div>

      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-white/60">{startsDisplay}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[var(--workspace-shell-panel)]">
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="record">Afterwards</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-4 space-y-4">
          <div className={panelClass}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-white/10 bg-white/5"
                />
              </div>
              <div className="space-y-2">
                <Label>Date & time</Label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="border-white/10 bg-white/5"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Location</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="border-white/10 bg-white/5"
                />
              </div>
              <div className="space-y-2">
                <Label>Series</Label>
                <Select value={seriesId} onValueChange={setSeriesId}>
                  <SelectTrigger className="border-white/10 bg-white/5">
                    <SelectValue placeholder="Standalone meetup" />
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
                <Label>Session in series</Label>
                <Input
                  value={seriesLabel}
                  onChange={(e) => setSeriesLabel(e.target.value)}
                  placeholder="Week 3 · Chapter 5"
                  className="border-white/10 bg-white/5"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Agenda notes</Label>
                <WorkspaceRichTextEditor
                  value={sessionNotes}
                  onChange={setSessionNotes}
                  minHeight={100}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Meal plan</Label>
                <WorkspaceRichTextEditor
                  value={mealPlan}
                  onChange={setMealPlan}
                  placeholder="Main, sides, dietary notes…"
                  minHeight={100}
                />
              </div>
            </div>
          </div>

          <div className={panelClass}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Parts of the evening</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/10"
                onClick={() =>
                  setEveningParts((p) => [
                    ...p,
                    {
                      id: `part-${Date.now()}`,
                      title: 'New section',
                      notes: '',
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-3 w-3" />
                Add part
              </Button>
            </div>
            <div className="space-y-3">
              {eveningParts.map((part, i) => (
                <div
                  key={part.id}
                  className="rounded-xl border border-white/8 p-3"
                >
                  <Input
                    value={part.title}
                    onChange={(e) => {
                      const next = [...eveningParts];
                      next[i] = { ...part, title: e.target.value };
                      setEveningParts(next);
                    }}
                    className="mb-2 border-white/10 bg-white/5 font-medium"
                  />
                  <WorkspaceRichTextEditor
                    value={part.notes}
                    onChange={(html) => {
                      const next = [...eveningParts];
                      next[i] = { ...part, notes: html };
                      setEveningParts(next);
                    }}
                    placeholder="What happens in this segment?"
                    minHeight={80}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={panelClass}>
            <h3 className="mb-3 font-semibold">Who&apos;s attending</h3>
            <div className="flex flex-wrap gap-2">
              {detail.attendees.map((m) => {
                const on = attending.has(m.userId);
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => {
                      const next = new Set(attending);
                      if (on) next.delete(m.userId);
                      else next.add(m.userId);
                      setAttending(next);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      on
                        ? 'bg-[var(--keel-teal)]/20 text-[#5eead4] ring-1 ring-[var(--keel-teal)]/40'
                        : 'bg-white/5 text-white/60 ring-1 ring-white/10'
                    }`}
                  >
                    {m.displayName}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isPending}
              className={workspaceBtnPrimaryMd}
              onClick={savePlan}
            >
              Save plan
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/10"
              onClick={saveAsTemplate}
            >
              Save as template
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/10"
              onClick={() => {
                startTransition(async () => {
                  await updateCommunityMeetup({
                    accountId: detail.accountId,
                    accountSlug,
                    eventId: detail.id,
                    status: 'completed',
                  });
                  toast.success('Marked complete');
                });
              }}
            >
              Mark completed
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="content" className="mt-4 space-y-4">
          <div className={panelClass}>
            <h3 className="mb-4 font-semibold">Session content</h3>
            {detail.contentItems.length === 0 ? (
              <p className="text-sm text-white/50">No content items yet.</p>
            ) : (
              <ul className="space-y-3">
                {detail.contentItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/8 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <MeetupContentItemView item={item} />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-white/40 hover:text-rose-400"
                      onClick={() => {
                        startTransition(async () => {
                          await deleteMeetupContentItem({
                            accountSlug,
                            eventId: detail.id,
                            itemId: item.id,
                          });
                          window.location.reload();
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={panelClass}>
            <h3 className="mb-3 font-semibold">Add content</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newContentKind}
                  onValueChange={(v) =>
                    setNewContentKind(v as typeof newContentKind)
                  }
                >
                  <SelectTrigger className="border-white/10 bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="video">Video URL</SelectItem>
                    <SelectItem value="richtext">Rich text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newContentTitle}
                  onChange={(e) => setNewContentTitle(e.target.value)}
                  className="border-white/10 bg-white/5"
                />
              </div>
              {(newContentKind === 'link' ||
                newContentKind === 'youtube' ||
                newContentKind === 'video') && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>URL</Label>
                  <Input
                    value={newContentUrl}
                    onChange={(e) => setNewContentUrl(e.target.value)}
                    placeholder="https://"
                    className="border-white/10 bg-white/5"
                  />
                  {newContentKind === 'youtube' && newContentUrl.trim() ? (
                    <YoutubeEmbed
                      url={newContentUrl}
                      title={newContentTitle || 'Preview'}
                    />
                  ) : null}
                </div>
              )}
              {newContentKind === 'richtext' && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Text</Label>
                  <WorkspaceRichTextEditor
                    value={newContentBody}
                    onChange={setNewContentBody}
                    minHeight={120}
                  />
                </div>
              )}
            </div>
            <Button
              type="button"
              className={`mt-4 ${workspaceBtnPrimaryMd}`}
              disabled={isPending}
              onClick={addContent}
            >
              Add to meetup
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="record" className="mt-4 space-y-4">
          <div className={panelClass}>
            <h3 className="mb-2 font-semibold">Transcript / raw notes</h3>
            <p className="mb-3 text-xs text-white/50">
              Paste notes or a transcript after the meetup. Use AI to generate a
              summary for leaders.
            </p>
            <WorkspaceRichTextEditor
              value={transcript}
              onChange={setTranscript}
              minHeight={200}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-white/10"
                disabled={isPending}
                onClick={saveRecord}
              >
                Save notes
              </Button>
              <Button
                type="button"
                className={workspaceBtnPrimaryMd}
                disabled={isPending}
                onClick={runSummary}
              >
                <Sparkles className="h-4 w-4" />
                Summarize with AI
              </Button>
            </div>
          </div>

          {aiSummary ? (
            <div className={panelClass}>
              <h3 className="mb-2 font-semibold">AI summary</h3>
              <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm text-white/80">
                {aiSummary}
              </div>
            </div>
          ) : null}

          <div className={panelClass}>
            <h3 className="mb-2 font-semibold">Reflection (leaders)</h3>
            <WorkspaceRichTextEditor
              value={reflection}
              onChange={setReflection}
              placeholder="Follow-ups, pastoral notes…"
              minHeight={120}
            />
            <Button
              type="button"
              className={`mt-3 ${workspaceBtnPrimaryMd}`}
              disabled={isPending}
              onClick={saveRecord}
            >
              Save record
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
