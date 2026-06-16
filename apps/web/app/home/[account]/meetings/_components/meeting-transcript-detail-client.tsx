'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ChevronLeft, Loader2, Mic, Sparkles, Trash2 } from 'lucide-react';

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

import pathsConfig from '~/config/paths.config';
import type { TaskAssignmentOption } from '~/home/(user)/_lib/actions/task-actions';
import { ExtractWorkspaceTasksClient } from '~/home/[account]/tasks/_components/extract-workspace-tasks-client';

import {
  deleteMeetingTranscript,
  updateMeetingTranscript,
} from '../../meeting-transcripts/_lib/server/server-actions';
import { meetingDisplayDate } from '../_lib/format-meeting-date';

type Transcript = {
  id: string;
  title: string;
  content: string;
  meetingDate: string | null;
  createdAt: string;
  clientId: string | null;
  dealId: string | null;
  clientName: string | null;
  dealTitle: string | null;
};

type ClientOption = { id: string; name: string };

type Props = {
  accountId: string;
  accountSlug: string;
  transcript: Transcript;
  clients: ClientOption[];
  canEdit: boolean;
  assignmentOptions: TaskAssignmentOption[];
};

export function MeetingTranscriptDetailClient({
  accountId,
  accountSlug,
  transcript,
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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 pb-16 pt-2 md:px-6">
      <div>
        <Link
          href={meetingsPath}
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          All meetings
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
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
                    className="mt-1 border-white/10 bg-white/5 text-lg font-semibold text-white"
                  />
                </div>
                <div className="max-w-xs">
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
                <div className="max-w-md">
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
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {transcript.title}
                </h1>
                <p className="text-sm text-zinc-400">
                  {meetingDisplayDate(transcript.meetingDate, transcript.createdAt)}
                </p>
              </>
            )}
            {contextLabel ? (
              <p className="text-sm text-zinc-400">
                {clientPath && resolvedClientName ? (
                  <>
                    Client:{' '}
                    <Link href={clientPath} className="text-[#5eead4] hover:underline">
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
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={remove}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          ) : null}
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <Mic className="h-4 w-4 text-[var(--keel-teal)]" />
          <h2 className="text-sm font-semibold text-white">Transcript</h2>
        </div>
        <pre className="max-h-[min(50vh,520px)] overflow-auto whitespace-pre-wrap rounded-xl border border-white/6 bg-black/20 p-4 text-sm leading-relaxed text-zinc-200">
          {transcript.content}
        </pre>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--keel-teal)]" />
          <h2 className="text-sm font-semibold text-white">Extract tasks</h2>
        </div>
        <p className="text-sm text-zinc-400">
          Review AI-suggested tasks from this transcript before adding them to the
          workspace.
        </p>
        <ExtractWorkspaceTasksClient
          accountId={accountId}
          accountSlug={accountSlug}
          assignmentOptions={assignmentOptions}
          embedded
          initialRawText={transcript.content}
          defaultClientId={clientId || transcript.clientId}
          successRedirectHref={tasksPath}
        />
      </section>
    </div>
  );
}
