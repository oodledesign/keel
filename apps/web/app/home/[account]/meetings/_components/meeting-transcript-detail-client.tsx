'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Check,
  ChevronLeft,
  Copy,
  Loader2,
  Mic,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { cn } from '@kit/ui/utils';

import { workspacePageContentClassName } from '~/components/workspace-shell/workspace-shell-styles';
import pathsConfig from '~/config/paths.config';
import type { TaskAssignmentOption } from '~/home/(user)/_lib/actions/task-actions';
import { ExtractWorkspaceTasksClient } from '~/home/[account]/tasks/_components/extract-workspace-tasks-client';
import {
  collectSpeakerNameSuggestions,
  serializeTranscriptSegments,
  type TranscriptSegment,
} from '~/lib/recorder/transcript-speakers';

import {
  deleteMeetingTranscript,
  updateMeetingTranscript,
} from '../../meeting-transcripts/_lib/server/server-actions';
import { meetingDisplayDate } from '../_lib/format-meeting-date';
import { MeetingSpeakerLabelsEditor } from './meeting-speaker-labels-editor';

type Transcript = {
  id: string;
  title: string;
  content: string;
  speakerSegments: TranscriptSegment[];
  calendarAttendees: Array<{ name: string; email: string }>;
  meetingDate: string | null;
  createdAt: string;
  clientId: string | null;
  dealId: string | null;
  clientName: string | null;
  dealTitle: string | null;
};

type MeetingSummary = {
  summaryText: string;
  attendeeEmails: string[];
  generatedAt: string;
} | null;

type ClientOption = { id: string; name: string };

type Props = {
  accountId: string;
  accountSlug: string;
  transcript: Transcript;
  summary: MeetingSummary;
  clients: ClientOption[];
  canEdit: boolean;
  assignmentOptions: TaskAssignmentOption[];
};

const panelClassName =
  'rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-5 shadow-[0_18px_50px_rgba(4,10,24,0.24)]';

export function MeetingTranscriptDetailClient({
  accountId,
  accountSlug,
  transcript,
  summary,
  clients,
  canEdit,
  assignmentOptions,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(transcript.title);
  const [meetingDate, setMeetingDate] = useState(
    transcript.meetingDate ?? transcript.createdAt.slice(0, 10),
  );
  const [clientId, setClientId] = useState(transcript.clientId ?? '');
  const [copied, setCopied] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const meetingsPath = pathsConfig.app.accountMeetings.replace(
    '[account]',
    accountSlug,
  );
  const tasksPath = pathsConfig.app.accountTasks.replace(
    '[account]',
    accountSlug,
  );
  const clientPath = clientId
    ? `${pathsConfig.app.accountClients.replace('[account]', accountSlug)}/${clientId}`
    : null;

  const resolvedClientName =
    transcript.clientName ||
    clients.find((client) => client.id === clientId)?.name ||
    null;
  const contextLabel = resolvedClientName || transcript.dealTitle;
  const speakerSuggestions = collectSpeakerNameSuggestions({
    calendarAttendees: transcript.calendarAttendees,
    clientName: resolvedClientName,
    clients,
  });
  const displayContent =
    transcript.speakerSegments.length > 0
      ? serializeTranscriptSegments(transcript.speakerSegments)
      : transcript.content;

  const saveMeta = () => {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await updateMeetingTranscript({
          accountId,
          accountSlug,
          transcriptId: transcript.id,
          title: title.trim() || 'Meeting transcript',
          meetingDate: meetingDate || null,
        });
        toast.success('Meeting updated');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Update failed');
      }
    });
  };

  const saveClientLink = (nextClientId: string) => {
    if (!canEdit) return;
    if (!nextClientId) {
      toast.error('Choose a client');
      return;
    }

    setClientId(nextClientId);
    startTransition(async () => {
      try {
        await updateMeetingTranscript({
          accountId,
          accountSlug,
          transcriptId: transcript.id,
          clientId: nextClientId,
          dealId: null,
        });
        toast.success('Client link updated');
        router.refresh();
      } catch (error) {
        setClientId(transcript.clientId ?? '');
        toast.error(error instanceof Error ? error.message : 'Update failed');
      }
    });
  };

  const remove = () => {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await deleteMeetingTranscript({
          accountId,
          accountSlug,
          transcriptId: transcript.id,
        });
        toast.success('Meeting deleted');
        router.push(meetingsPath);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Delete failed');
      }
    });
  };

  const copyTranscript = async () => {
    if (!displayContent.trim()) {
      toast.error('Nothing to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      toast.success('Transcript copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-6xl space-y-6 pb-16 pt-2',
        workspacePageContentClassName,
      )}
    >
      <Link
        href={meetingsPath}
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        All meetings
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-6">
          {summary ? (
            <section className={panelClassName}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--keel-teal)]" />
                  <h2 className="text-sm font-semibold text-white">Summary</h2>
                </div>
                {summary.attendeeEmails.length > 0 ? (
                  <p className="text-xs text-zinc-400">
                    {summary.attendeeEmails.length} attendee
                    {summary.attendeeEmails.length === 1 ? '' : 's'} from calendar
                  </p>
                ) : null}
              </div>
              <div className="space-y-4 rounded-xl border border-white/6 bg-black/20 p-4 text-sm leading-relaxed text-zinc-200">
                {summary.summaryText.split('\n\n').map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>
            </section>
          ) : null}

          <section className={panelClassName}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-[var(--keel-teal)]" />
              <h2 className="text-sm font-semibold text-white">Transcript</h2>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={() => void copyTranscript()}
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? 'Copied' : 'Copy transcript'}
            </Button>
          </div>
          <div className="max-h-[min(70vh,720px)] overflow-auto rounded-xl border border-white/6 bg-black/20 p-4 text-sm leading-relaxed text-zinc-200">
            {transcript.speakerSegments.length > 0 ? (
              <div className="space-y-4">
                {transcript.speakerSegments.map((segment, index) => (
                  <div key={`${segment.speaker}-${index}`}>
                    <p className="text-xs font-semibold text-[var(--keel-teal)]">
                      {segment.speaker}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="whitespace-pre-wrap">{displayContent}</pre>
            )}
          </div>
        </section>
        </div>

        <aside className="space-y-6">
          <section className={panelClassName}>
            <h2 className="text-sm font-semibold text-white">Meeting details</h2>

            <div className="mt-4 space-y-4">
              {canEdit ? (
                <>
                  <div>
                    <Label htmlFor="detail-title" className="text-xs text-zinc-500">
                      Title
                    </Label>
                    <Input
                      id="detail-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={saveMeta}
                      className="mt-1 border-white/10 bg-white/5 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="detail-date" className="text-xs text-zinc-500">
                      Meeting date
                    </Label>
                    <Input
                      id="detail-date"
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      onBlur={saveMeta}
                      className="mt-1 border-white/10 bg-white/5 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="detail-client" className="text-xs text-zinc-500">
                      Client
                    </Label>
                    <Select
                      value={clientId || undefined}
                      onValueChange={saveClientLink}
                      disabled={pending}
                    >
                      <SelectTrigger
                        id="detail-client"
                        className="mt-1 border-white/10 bg-white/5 text-white"
                      >
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#1A2535] text-white">
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-zinc-500">Title</p>
                    <p className="mt-1 font-medium text-white">{transcript.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Meeting date</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {meetingDisplayDate(
                        transcript.meetingDate,
                        transcript.createdAt,
                      )}
                    </p>
                  </div>
                </>
              )}

              {contextLabel ? (
                <p className="text-sm text-zinc-400">
                  {clientPath && resolvedClientName ? (
                    <>
                      Client:{' '}
                      <Link
                        href={clientPath}
                        className="text-[#5eead4] hover:underline"
                      >
                        {resolvedClientName}
                      </Link>
                    </>
                  ) : transcript.dealTitle ? (
                    <>Linked to deal: {transcript.dealTitle}</>
                  ) : (
                    <>Linked to: {contextLabel}</>
                  )}
                </p>
              ) : canEdit ? (
                <p className="text-sm text-zinc-500">No client linked yet.</p>
              ) : null}
            </div>

            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                className="mt-5 w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={remove}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete meeting
              </Button>
            ) : null}
          </section>

          <section className={panelClassName}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--keel-teal)]" />
              <h2 className="text-sm font-semibold text-white">Extract tasks</h2>
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Review AI-suggested tasks from this transcript before adding them to
              the workspace.
            </p>
            <Button
              type="button"
              className="mt-4 w-full bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
              onClick={() => setExtractOpen(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Extract tasks with AI
            </Button>
          </section>

          <MeetingSpeakerLabelsEditor
            accountId={accountId}
            accountSlug={accountSlug}
            transcriptId={transcript.id}
            speakerSegments={transcript.speakerSegments}
            suggestions={speakerSuggestions}
            canEdit={canEdit}
            onSaved={() => router.refresh()}
          />
        </aside>
      </div>

      <Dialog open={extractOpen} onOpenChange={setExtractOpen}>
        <DialogContent className="max-h-[min(90vh,900px)] max-w-4xl gap-0 overflow-hidden border-white/10 bg-[var(--workspace-shell-panel)] p-0 text-white">
          <DialogHeader className="border-b border-white/10 px-6 py-4">
            <DialogTitle>Extract tasks</DialogTitle>
            <DialogDescription className="text-zinc-400">
              AI will analyse this meeting transcript and suggest actionable tasks.
              Review and edit before adding them to the workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(min(90vh,900px)-5.5rem)] overflow-y-auto px-6 py-5">
            {extractOpen ? (
              <ExtractWorkspaceTasksClient
                accountId={accountId}
                accountSlug={accountSlug}
                assignmentOptions={assignmentOptions}
                embedded
                initialRawText={displayContent}
                defaultClientId={clientId || transcript.clientId}
                successRedirectHref={tasksPath}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
