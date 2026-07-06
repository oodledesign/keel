'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Loader2, Mic, PlusCircle, Trash2, Upload } from 'lucide-react';

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
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import {
  createMeetingTranscript,
  deleteMeetingTranscript,
} from '../../meeting-transcripts/_lib/server/server-actions';
import { meetingDisplayDate, todayIsoDate } from '../_lib/format-meeting-date';
import type { MeetingTranscriptListRow } from '../_lib/server/meetings-page.loader';
import { MeetingParticipantAvatars } from './meeting-participant-avatars';

type TranscriptRow = MeetingTranscriptListRow;

type ClientOption = { id: string; name: string };

type Props = {
  accountId: string;
  accountSlug: string;
  transcripts: TranscriptRow[];
  clients: ClientOption[];
  canEdit: boolean;
};

function mapTranscript(row: MeetingTranscriptListRow): TranscriptRow {
  return row;
}

export function MeetingsPageContent({
  accountId,
  accountSlug,
  transcripts: initialTranscripts,
  clients,
  canEdit,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(() =>
    initialTranscripts.map((row) => mapTranscript(row)),
  );
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(todayIsoDate());
  const [clientId, setClientId] = useState('');
  const [jobId, setJobId] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    setRows(initialTranscripts.map((row) => mapTranscript(row)));
  }, [initialTranscripts]);

  useEffect(() => {
    if (!canEdit || searchParams.get('create') !== '1') {
      return;
    }

    const clientFromQuery = searchParams.get('clientId');
    const jobFromQuery = searchParams.get('jobId');
    if (clientFromQuery) {
      setClientId(clientFromQuery);
    }
    if (jobFromQuery) {
      setJobId(jobFromQuery);
    }
    setShowForm(true);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('create');
    nextParams.delete('clientId');
    nextParams.delete('jobId');
    const nextPath = nextParams.toString()
      ? `${pathsConfig.app.accountMeetings.replace('[account]', accountSlug)}?${nextParams.toString()}`
      : pathsConfig.app.accountMeetings.replace('[account]', accountSlug);

    router.replace(nextPath, { scroll: false });
  }, [accountSlug, canEdit, router, searchParams]);

  const meetingDetailPath = (id: string) =>
    pathsConfig.app.accountMeetingDetail
      .replace('[account]', accountSlug)
      .replace('[transcriptId]', id);
  const clientPath = (id: string) =>
    `${pathsConfig.app.accountClients.replace('[account]', accountSlug)}/${id}`;

  const resetForm = useCallback(() => {
    setTitle('');
    setMeetingDate(todayIsoDate());
    setClientId('');
    setJobId('');
    setContent('');
    setShowForm(false);
  }, []);

  const handleSave = () => {
    if (!canEdit) return;
    if (!clientId) {
      toast.error('Choose a client');
      return;
    }
    if (!content.trim()) {
      toast.error('Paste transcript content first');
      return;
    }

    startTransition(async () => {
      try {
        const created = await createMeetingTranscript({
          accountId,
          accountSlug,
          clientId,
          jobId: jobId || undefined,
          title: title.trim() || 'Meeting transcript',
          content: content.trim(),
          meetingDate: meetingDate || null,
          source: 'paste',
        });
        toast.success('Meeting saved');
        resetForm();
        router.push(meetingDetailPath(created.id));
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Save failed');
      }
    });
  };

  const handleFile = async (file: File) => {
    if (!canEdit) return;
    const text = await file.text();
    setTitle(file.name.replace(/\.[^.]+$/, ''));
    setContent(text);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await deleteMeetingTranscript({ accountId, accountSlug, transcriptId: id });
        setRows((prev) => prev.filter((row) => row.id !== id));
        toast.success('Deleted');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Delete failed');
      }
    });
  };

  const contextLabel = (row: TranscriptRow) => {
    if (row.clientName) return row.clientName;
    if (row.dealTitle) return row.dealTitle;
    if (row.clientId) {
      const match = clients.find((client) => client.id === row.clientId);
      if (match) return match.name;
    }
    return 'Unlinked';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-[var(--workspace-shell-text-muted)]">
          All meeting transcripts across clients. Open a meeting to read the full
          transcript and extract tasks with AI.
        </p>
        {canEdit ? (
          <Button
            size="sm"
            className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
            onClick={() => setShowForm((open) => !open)}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            {showForm ? 'Cancel' : 'Add meeting'}
          </Button>
        ) : null}
      </div>

      {canEdit && showForm ? (
        <div className="space-y-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-[var(--ozer-accent)]" />
            <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">New meeting</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="meeting-client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger
                  id="meeting-client"
                  className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                >
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="meeting-date">Meeting date</Label>
              <Input
                id="meeting-date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="meeting-title">Title</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Discovery call"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
            />
          </div>
          <div>
            <Label htmlFor="meeting-content">Transcript</Label>
            <Textarea
              id="meeting-content"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste transcript text…"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={handleSave}>
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              Save meeting
            </Button>
            <label className="inline-flex cursor-pointer items-center">
              <input
                type="file"
                accept=".txt,.md,.vtt,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
              <Button size="sm" variant="outline" type="button" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload file
                </span>
              </Button>
            </label>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--workspace-shell-border)] px-6 py-12 text-center">
          <Mic className="mx-auto mb-3 h-8 w-8 text-[var(--workspace-shell-text-muted)]" />
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">No meetings yet.</p>
          {canEdit ? (
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              Add a meeting or save transcripts from a client page.
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className={cn(
                'flex items-start justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)]',
                'bg-[var(--workspace-shell-panel)] px-4 py-3 transition-colors hover:border-[var(--ozer-accent)]/30',
              )}
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={meetingDetailPath(row.id)}
                  className="truncate text-sm font-medium text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent-muted)]"
                >
                  {row.title}
                </Link>
                <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                  {meetingDisplayDate(row.meetingDate, row.createdAt)}
                  {' · '}
                  {row.clientId ? (
                    <Link
                      href={clientPath(row.clientId)}
                      className="text-[var(--ozer-accent-muted)] hover:underline"
                    >
                      {contextLabel(row)}
                    </Link>
                  ) : (
                    contextLabel(row)
                  )}
                  {' · '}
                  {row.content.length.toLocaleString()} chars
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <MeetingParticipantAvatars participants={row.participants} />
                {canEdit ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-400"
                    disabled={pending}
                    onClick={() => handleDelete(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        Tip: you can also add meetings from a client&apos;s Meetings tab — they appear
        here automatically.
      </p>
    </div>
  );
}
