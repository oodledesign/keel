'use client';

import { useState } from 'react';

import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import { VideoWatchMetaPanel } from '~/components/videos/video-watch-meta-panel';
import { formatChapterTime, formatPublishedAt } from '~/lib/videos/format';
import type { VideoChapter } from '~/lib/videos/types';

import { VideoSummaryEditor } from './video-summary-editor';

function parseTimeToMs(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const parts = trimmed.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 2) {
    return (parts[0]! * 60 + parts[1]!) * 1000;
  }
  if (parts.length === 3) {
    return (parts[0]! * 3600 + parts[1]! * 60 + parts[2]!) * 1000;
  }
  return null;
}

export function VideoChaptersEditor(props: {
  videoId: string;
  initialChapters: VideoChapter[];
  initialSummary: string | null;
  transcriptPlainText: string | null;
  publishedAt: string | null;
  onSeek?: (ms: number) => void;
}) {
  const [chapters, setChapters] = useState<VideoChapter[]>(
    props.initialChapters,
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);

  const seek = props.onSeek ?? (() => undefined);
  const publishedLabel = formatPublishedAt(props.publishedAt);

  const runGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/videos/${props.videoId}/chapters/generate`,
        {
          method: 'POST',
        },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        chapters?: VideoChapter[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Failed to generate chapters');
      }
      setChapters(json.chapters ?? []);
      toast.success('Chapters generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateClick = () => {
    if (chapters.length > 0) {
      setConfirmGenerateOpen(true);
      return;
    }
    void runGenerate();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/videos/${props.videoId}/chapters`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapters }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        chapters?: VideoChapter[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Failed to save chapters');
      }
      setChapters(json.chapters ?? chapters);
      toast.success('Chapters saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {publishedLabel ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          <time dateTime={props.publishedAt ?? undefined}>
            {publishedLabel}
          </time>
        </p>
      ) : null}

      <VideoWatchMetaPanel
        chapters={chapters}
        transcriptPlainText={props.transcriptPlainText}
        onSeek={seek}
        variant="workspace"
      />

      <VideoSummaryEditor
        videoId={props.videoId}
        initialSummary={props.initialSummary}
        transcriptPlainText={props.transcriptPlainText}
      />

      <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Edit chapters
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={generating || !props.transcriptPlainText}
              onClick={handleGenerateClick}
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate with AI
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save chapters
            </Button>
          </div>
        </div>

        {!props.transcriptPlainText ? (
          <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
            Add a transcript in the video editor before generating chapters.
          </p>
        ) : null}

        <ul className="mt-4 space-y-2">
          {chapters.map((chapter, index) => (
            <li
              key={chapter.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-2"
            >
              <Input
                className="w-24 font-mono text-xs"
                defaultValue={formatChapterTime(chapter.startMs)}
                aria-label="Chapter start time"
                onBlur={(e) => {
                  const ms = parseTimeToMs(e.target.value);
                  if (ms == null) {
                    e.target.value = formatChapterTime(chapter.startMs);
                    return;
                  }
                  setChapters((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, startMs: ms } : row,
                    ),
                  );
                }}
              />
              <Input
                className="min-w-[12rem] flex-1"
                value={chapter.title}
                aria-label="Chapter title"
                onChange={(e) => {
                  const title = e.target.value;
                  setChapters((prev) =>
                    prev.map((row, i) =>
                      i === index ? { ...row, title } : row,
                    ),
                  );
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove chapter"
                onClick={() =>
                  setChapters((prev) => prev.filter((_, i) => i !== index))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() =>
            setChapters((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                title: 'New chapter',
                startMs: (prev[prev.length - 1]?.startMs ?? 0) + 60_000,
              },
            ])
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Add chapter
        </Button>
      </section>

      <AlertDialog
        open={confirmGenerateOpen}
        onOpenChange={setConfirmGenerateOpen}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing chapters?</AlertDialogTitle>
            <AlertDialogDescription>
              AI generation will overwrite your current chapter list. You can
              still edit titles and times before saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmGenerateOpen(false);
                void runGenerate();
              }}
            >
              Generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
