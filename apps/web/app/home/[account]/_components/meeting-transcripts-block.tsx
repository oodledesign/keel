'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import { Loader2, Mic, PlusCircle, Trash2, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

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
}: {
  accountId: string;
  accountSlug: string;
  clientId?: string;
  dealId?: string;
  canEdit: boolean;
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

  return (
    <div className="rounded-xl border border-white/10 bg-[var(--workspace-shell-panel)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-[var(--keel-teal)]" />
          <h3 className="text-sm font-semibold">Meeting transcripts</h3>
        </div>
        {accountSlug ? (
          <Link
            href={meetingsPath}
            className="text-xs font-medium text-[#5eead4] hover:underline"
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
        <div className="mb-4 space-y-3 rounded-lg border border-white/8 bg-white/3 p-3">
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transcripts yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-white/6 bg-white/3 px-3 py-2"
            >
              <div className="min-w-0">
                {accountSlug ? (
                  <Link
                    href={meetingDetailPath(row.id)}
                    className="truncate text-sm font-medium text-white hover:text-[#5eead4]"
                  >
                    {row.title}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-medium text-white">{row.title}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {meetingDisplayDate(row.meetingDate, row.createdAt)} ·{' '}
                  {row.content.length.toLocaleString()} chars
                </p>
              </div>
              {canEdit ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-red-400"
                  onClick={() => handleDelete(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
