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

type TranscriptRow = {
  id: string;
  title: string;
  content: string;
  source: string;
  meetingDate: string | null;
  createdAt: string;
  clientId: string | null;
  clientName: string | null;
  dealTitle: string | null;
};

type ClientOption = { id: string; name: string };

type Props = {
  accountId: string;
  accountSlug: string;
  transcripts: TranscriptRow[];
  clients: ClientOption[];
  canEdit: boolean;
};

function mapTranscript(row: {
  id: string;
  title: string;
  content: string;
  source: string;
  meetingDate?: string | null;
  createdAt: string;
  clientId?: string | null;
  clientName?: string | null;
  dealTitle?: string | null;
}): TranscriptRow {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    source: row.source,
    meetingDate: row.meetingDate ?? null,
    createdAt: row.createdAt,
    clientId: row.clientId ?? null,
    clientName: row.clientName ?? null,
    dealTitle: row.dealTitle ?? null,
  };
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
  const [content, setContent] = useState('');

  useEffect(() => {
    setRows(initialTranscripts.map((row) => mapTranscript(row)));
  }, [initialTranscripts]);

  useEffect(() => {
    if (!canEdit || searchParams.get('create') !== '1') {
      return;
    }

    const clientFromQuery = searchParams.get('clientId');
    if (clientFromQuery) {
      setClientId(clientFromQuery);
    }
    setShowForm(true);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('create');
    nextParams.delete('clientId');
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
        <p className="max-w-2xl text-sm text-zinc-400">
          All meeting transcripts across clients. Open a meeting to read the full
          transcript and extract tasks with AI.
        </p>
        {canEdit ? (
          <Button
            size="sm"
            className="bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
            onClick={() => setShowForm((open) => !open)}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            {showForm ? 'Cancel' : 'Add meeting'}
          </Button>
        ) : null}
      </div>

      {canEdit && showForm ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-4">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-[var(--keel-teal)]" />
            <h3 className="text-sm font-semibold text-white">New meeting</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="meeting-client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger
                  id="meeting-client"
                  className="border-white/10 bg-white/5 text-white"
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
            <div>
              <Label htmlFor="meeting-date">Meeting date</Label>
              <Input
                id="meeting-date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="border-white/10 bg-white/5 text-white"
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
              className="border-white/10 bg-white/5 text-white"
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
              className="border-white/10 bg-white/5 text-white"
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
        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
          <Mic className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-400">No meetings yet.</p>
          {canEdit ? (
            <p className="mt-1 text-xs text-zinc-500">
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
                'flex items-start justify-between gap-3 rounded-xl border border-white/8',
                'bg-[var(--workspace-shell-panel)] px-4 py-3 transition-colors hover:border-[var(--keel-teal)]/30',
              )}
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={meetingDetailPath(row.id)}
                  className="truncate text-sm font-medium text-white hover:text-[#5eead4]"
                >
                  {row.title}
                </Link>
                <p className="mt-1 text-xs text-zinc-500">
                  {meetingDisplayDate(row.meetingDate, row.createdAt)}
                  {' · '}
                  {row.clientId ? (
                    <Link
                      href={clientPath(row.clientId)}
                      className="text-[#5eead4] hover:underline"
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
              {canEdit ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-red-400"
                  disabled={pending}
                  onClick={() => handleDelete(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-zinc-500">
        Tip: you can also add meetings from a client&apos;s Meetings tab — they appear
        here automatically.
      </p>
    </div>
  );
}
