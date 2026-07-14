'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  Copy,
  Eye,
  Loader2,
  Mic,
  MoreHorizontal,
  PlusCircle,
  Trash2,
  Upload,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
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

function meetingSortKey(row: TranscriptRow) {
  return row.meetingDate || row.createdAt.slice(0, 10);
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
  const [rows, setRows] = useState(initialTranscripts);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(todayIsoDate());
  const [clientId, setClientId] = useState('');
  const [jobId, setJobId] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    setRows(initialTranscripts);
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

  const upcomingRows = useMemo(() => {
    const today = todayIsoDate();
    return [...rows]
      .filter((row) => meetingSortKey(row) >= today)
      .sort((a, b) => meetingSortKey(a).localeCompare(meetingSortKey(b)))
      .slice(0, 8);
  }, [rows]);

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

  const handleCopyTranscript = async (row: TranscriptRow) => {
    try {
      await navigator.clipboard.writeText(row.content);
      toast.success('Transcript copied');
    } catch {
      toast.error('Could not copy transcript');
    }
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[var(--workspace-shell-text)]">
            Meetings
          </h1>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            All meeting transcripts across clients. Open a meeting to read the full
            transcript and extract tasks with AI.
          </p>
        </div>
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

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-2">
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
                      className="truncate text-sm font-medium text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent)]"
                    >
                      {row.title}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                      {meetingDisplayDate(row.meetingDate, row.createdAt)}
                      {' · '}
                      {row.clientId ? (
                        <Link
                          href={clientPath(row.clientId)}
                          className="font-medium text-[var(--workspace-shell-text)] hover:underline"
                        >
                          {contextLabel(row)}
                        </Link>
                      ) : (
                        <span className="font-medium text-[var(--workspace-shell-text)]">
                          {contextLabel(row)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <MeetingParticipantAvatars participants={row.participants} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[var(--workspace-shell-text-muted)]"
                          disabled={pending}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Meeting actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={meetingDetailPath(row.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View meeting
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handleCopyTranscript(row)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy transcript
                        </DropdownMenuItem>
                        {canEdit ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(row.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="pt-2 text-xs text-[var(--workspace-shell-text-muted)]">
            Tip: you can also add meetings from a client&apos;s Meetings tab — they appear
            here automatically.
          </p>
        </div>

        <aside className="w-full shrink-0 lg:w-64 xl:w-72">
          <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
            <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Upcoming meetings
            </h2>
            {upcomingRows.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--workspace-shell-text-muted)]">
                No upcoming meetings.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {upcomingRows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={meetingDetailPath(row.id)}
                      className="block rounded-lg px-1 py-0.5 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
                    >
                      <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                        {row.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
                        {meetingDisplayDate(row.meetingDate, row.createdAt)}
                      </p>
                      <p className="truncate text-xs font-medium text-[var(--workspace-shell-text)]">
                        {contextLabel(row)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
