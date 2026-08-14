'use client';

import { useState } from 'react';

import { Loader2, Sparkles } from 'lucide-react';

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
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

export function VideoSummaryEditor(props: {
  videoId: string;
  initialSummary: string | null;
  transcriptPlainText: string | null;
}) {
  const [summary, setSummary] = useState(props.initialSummary ?? '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);

  const runGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/videos/${props.videoId}/summary/generate`, {
        method: 'POST',
      });
      const json = (await res.json()) as {
        ok?: boolean;
        summary?: string | null;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Failed to generate summary');
      }
      setSummary(json.summary ?? '');
      toast.success('Summary generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateClick = () => {
    if (summary.trim()) {
      setConfirmGenerateOpen(true);
      return;
    }
    void runGenerate();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/videos/${props.videoId}/summary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        summary?: string | null;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Failed to save summary');
      }
      setSummary(json.summary ?? '');
      toast.success('Summary saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Summary
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
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save summary
          </Button>
        </div>
      </div>

      {!props.transcriptPlainText ? (
        <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
          Add a transcript in the video editor before generating a summary.
        </p>
      ) : null}

      <Textarea
        className="mt-4 min-h-[100px] bg-[var(--workspace-shell-canvas)]"
        value={summary}
        maxLength={600}
        placeholder="Short summary of what this video covers…"
        onChange={(e) => setSummary(e.target.value)}
      />

      <AlertDialog
        open={confirmGenerateOpen}
        onOpenChange={setConfirmGenerateOpen}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing summary?</AlertDialogTitle>
            <AlertDialogDescription>
              AI generation will overwrite your current summary. You can still
              edit it before saving.
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
    </section>
  );
}
