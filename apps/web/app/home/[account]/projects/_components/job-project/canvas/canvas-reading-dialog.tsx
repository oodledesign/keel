'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

import { NoteBody } from './canvas-nodes';

export type CanvasReading =
  | { status: 'loading' }
  | { status: 'ready'; title: string; markdown: string }
  | { status: 'error'; message: string };

/** Read-only view of a note or written doc, for people who can't edit it. */
export function CanvasReadingDialog({
  reading,
  onClose,
}: {
  reading: CanvasReading | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={reading !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {reading?.status === 'ready'
              ? reading.title || 'Untitled'
              : reading?.status === 'error'
                ? "Couldn't open this"
                : 'Loading…'}
          </DialogTitle>
        </DialogHeader>
        {reading?.status === 'ready' ? (
          <div className="min-h-0 flex-1 overflow-y-auto text-sm leading-relaxed text-[var(--workspace-shell-text-muted)]">
            {reading.markdown.trim() ? (
              <NoteBody markdown={reading.markdown} />
            ) : (
              <p>Nothing written yet.</p>
            )}
          </div>
        ) : reading?.status === 'error' ? (
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            {reading.message}
          </p>
        ) : (
          <div className="h-48 animate-pulse rounded-lg bg-[var(--workspace-control-surface)]/50" />
        )}
      </DialogContent>
    </Dialog>
  );
}
