'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { Sparkles } from 'lucide-react';

import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { savePhasePageDoc } from '../../_lib/server/server-actions';
import { getErrorMessage } from '../../_lib/error-message';

export function PhasePageEditor({
  accountId,
  accountSlug,
  jobId,
  phaseId,
  docId,
  initialTitle,
  initialContent,
  canEdit,
  onOpenAi,
}: {
  accountId: string;
  accountSlug: string;
  jobId: string;
  phaseId: string;
  docId: string;
  initialTitle: string;
  initialContent: string;
  canEdit: boolean;
  onOpenAi?: () => void;
}) {
  const [content, setContent] = useState(initialContent);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [, startTransition] = useTransition();
  const lastSaved = useRef(initialContent);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setContent(initialContent);
    lastSaved.current = initialContent;
  }, [initialContent, docId]);

  const persist = useCallback(
    (nextContent: string) => {
      if (!canEdit || nextContent === lastSaved.current) return;
      setSaveState('saving');
      startTransition(async () => {
        try {
          await savePhasePageDoc({
            accountId,
            accountSlug,
            jobId,
            phaseId,
            docId,
            content: nextContent,
            title: initialTitle,
          });
          lastSaved.current = nextContent;
          setSaveState('saved');
        } catch (err) {
          setSaveState('error');
          toast.error(getErrorMessage(err));
        }
      });
    },
    [
      accountId,
      accountSlug,
      canEdit,
      docId,
      initialTitle,
      jobId,
      phaseId,
      startTransition,
    ],
  );

  useEffect(() => {
    if (!canEdit) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(content), 900);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, canEdit, persist]);

  return (
    <section className="rounded-xl border border-zinc-700 bg-[var(--workspace-shell-panel)] p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Phase page</h2>
          <p className="text-xs text-zinc-500">
            {canEdit
              ? saveState === 'saving'
                ? 'Saving…'
                : saveState === 'saved'
                  ? 'Saved'
                  : saveState === 'error'
                    ? 'Save failed'
                    : 'Autosaves as you type'
              : 'Read-only'}
          </p>
        </div>
        <button
          type="button"
          disabled={!canEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          onClick={() => {
            if (canEdit && onOpenAi) onOpenAi();
            else toast.message('You need edit permission to generate content');
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate page with AI
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phase-page-content" className="sr-only">
          Phase page content
        </Label>
        <Textarea
          id="phase-page-content"
          value={content}
          onChange={(e) => {
            setSaveState('idle');
            setContent(e.target.value);
          }}
          readOnly={!canEdit}
          rows={18}
          placeholder="Write this phase's plan, decisions, links, and deliverables (Markdown)…"
          className="min-h-[280px] resize-y border-zinc-600 bg-zinc-900/60 text-sm leading-relaxed text-white placeholder:text-zinc-600 md:min-h-[360px]"
        />
      </div>
    </section>
  );
}
