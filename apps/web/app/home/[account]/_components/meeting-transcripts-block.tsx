'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import { Loader2, Mic, PlusCircle, Trash2, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

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
  createdAt: string;
};

export function MeetingTranscriptsBlock({
  accountId,
  clientId,
  dealId,
  canEdit,
}: {
  accountId: string;
  clientId?: string;
  dealId?: string;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<TranscriptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMeetingTranscripts({
        accountId,
        clientId,
        dealId,
      });
      setRows((data ?? []) as TranscriptRow[]);
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
          clientId,
          dealId,
          title: title.trim() || 'Meeting transcript',
          content: content.trim(),
          source: 'paste',
        });
        setTitle('');
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
        await deleteMeetingTranscript({ accountId, transcriptId: id });
        toast.success('Deleted');
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Delete failed');
      }
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[var(--workspace-shell-panel)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Mic className="h-4 w-4 text-[var(--keel-teal)]" />
        <h3 className="text-sm font-semibold">Meeting transcripts</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Save call transcripts here to reference when generating proposals with AI.
      </p>

      {canEdit ? (
        <div className="mb-4 space-y-3 rounded-lg border border-white/8 bg-white/3 p-3">
          <div>
            <Label htmlFor="transcript-title">Title</Label>
            <Input
              id="transcript-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Discovery call — 10 Jun 2026"
            />
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
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
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
                <p className="truncate text-sm font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleDateString('en-GB')} ·{' '}
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
