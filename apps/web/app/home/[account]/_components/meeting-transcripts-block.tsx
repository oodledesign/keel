'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import { Loader2, Mic, PlusCircle, Trash2, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import {
  meetingDisplayDate,
  todayIsoDate,
} from '../meetings/_lib/format-meeting-date';
import {
  createMeetingTranscript,
  deleteMeetingTranscript,
  listMeetingTranscripts,
} from '../meeting-transcripts/_lib/server/server-actions';

type TranscriptRow = {
  id: string;
  title: string;
  content: string;
  source: string;
  meetingDate: string | null;
  createdAt: string;
};

export function MeetingTranscriptsBlock({
  accountId,
  accountSlug,
  clientId,
  dealId,
  canEdit,
  variant = 'default',
}: {
  accountId: string;
  accountSlug: string;
  clientId?: string;
  dealId?: string;
  canEdit: boolean;
  /** List-only layout for client detail — no inline create form. */
  variant?: 'default' | 'list';
}) {
  const [rows, setRows] = useState<TranscriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(todayIsoDate());
  const [content, setContent] = useState('');

  const meetingsPath = pathsConfig.app.accountMeetings.replace(
    '[account]',
    accountSlug,
  );
  const newMeetingHref = clientId
    ? `${meetingsPath}?clientId=${encodeURIComponent(clientId)}&create=1`
    : `${meetingsPath}?create=1`;
  const meetingDetailPath = (id: string) =>
    pathsConfig.app.accountMeetingDetail
      .replace('[account]', accountSlug)
      .replace('[transcriptId]', id);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMeetingTranscripts({
        accountId,
        clientId,
        dealId,
      });
      setRows(
        (data ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          content: row.content,
          source: row.source,
          meetingDate: row.meetingDate ?? null,
          createdAt: row.createdAt,
        })),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId, dealId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = () => {
    if (!canEdit || !content.trim()) {
      toast.error('Paste transcript content first');
      return;
    }
    startTransition(async () => {
      try {
        await createMeetingTranscript({
          accountId,
          accountSlug,
          clientId,
          dealId,
          title: title.trim() || 'Meeting transcript',
          content: content.trim(),
          meetingDate: meetingDate || null,
          source: 'paste',
        });
        setTitle('');
        setMeetingDate(todayIsoDate());
        setContent('');
        toast.success('Transcript saved');
        await load();
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
  };

  const handleDelete = (id: string) => {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await deleteMeetingTranscript({
          accountId,
          accountSlug,
          transcriptId: id,
        });
        toast.success('Deleted');
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Delete failed');
      }
    });
  };

  const meetingList = loading ? (
    <p className="text-sm text-[var(--workspace-shell-text-muted)]">Loading…</p>
  ) : rows.length === 0 ? (
    <p className="text-sm text-[var(--workspace-shell-text-muted)]">No meetings yet.</p>
  ) : (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className={cn(
            'flex items-start justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)]',
            variant === 'list'
              ? 'bg-[var(--workspace-shell-panel)] px-4 py-3 transition-colors hover:border-[var(--ozer-accent)]/30'
              : 'border-[color:var(--workspace-shell-border)] bg-white/3 px-3 py-2',
          )}
        >
          <div className="min-w-0">
            {accountSlug ? (
              <Link
                href={meetingDetailPath(row.id)}
                className="truncate text-sm font-medium text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent-muted)]"
              >
                {row.title}
              </Link>
            ) : (
              <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">{row.title}</p>
            )}
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              {meetingDisplayDate(row.meetingDate, row.createdAt)}
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
  );

  if (variant === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          {canEdit ? (
            <Button
              size="sm"
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              asChild
            >
              <Link href={newMeetingHref}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New meeting
              </Link>
            </Button>
          ) : null}
        </div>
        {meetingList}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-[var(--ozer-accent)]" />
          <h3 className="text-sm font-semibold">Meeting transcripts</h3>
        </div>
        {accountSlug ? (
          <Link
            href={meetingsPath}
            className="text-xs font-medium text-[var(--ozer-accent-muted)] hover:underline"
          >
            All meetings
          </Link>
        ) : null}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Save call transcripts here to reference when generating proposals or extracting
        tasks with AI.
      </p>

      {canEdit ? (
        <div className="mb-4 space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-white/3 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="transcript-title">Title</Label>
              <Input
                id="transcript-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Discovery call"
              />
            </div>
            <div>
              <Label htmlFor="transcript-date">Meeting date</Label>
              <Input
                id="transcript-date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="transcript-content">Transcript</Label>
            <Textarea
              id="transcript-content"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste transcript text…"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={handleSave}>
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="mr-2 h-4 w-4" />
              )}
              Save transcript
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

      {meetingList}
    </div>
  );
}
