'use client';

import { ExternalLink } from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@kit/ui/dialog';

import type { EmbedSource } from '~/lib/projects/canvas/canvas-embed';

export const EMBED_IFRAME_ALLOW =
  'clipboard-read; clipboard-write; fullscreen; autoplay; picture-in-picture; encrypted-media';
export const EMBED_IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads';

/**
 * An embedded page opened large — a Google file in its editor, a video, a
 * design. Google decides whether the signed-in account can edit.
 */
export function CanvasEmbedDialog({
  embed,
  title,
  onClose,
}: {
  embed: EmbedSource | null;
  title?: string;
  onClose: () => void;
}) {
  const src = embed ? (embed.editUrl ?? embed.previewUrl) : null;
  return (
    <Dialog open={Boolean(embed)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-6xl flex-col gap-2 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] p-3 text-[var(--workspace-shell-text)] sm:max-w-6xl"
        data-test="canvas-embed-dialog"
      >
        {embed && src ? (
          <>
            <div className="flex items-center gap-2 pr-8">
              <DialogTitle className="min-w-0 flex-1 truncate text-sm font-semibold">
                {title?.trim() || embed.label}
              </DialogTitle>
              <a
                href={embed.openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--workspace-shell-accent-text)] hover:underline"
              >
                Open original
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <iframe
              key={src}
              title={title?.trim() || embed.label}
              src={src}
              allow={EMBED_IFRAME_ALLOW}
              sandbox={EMBED_IFRAME_SANDBOX}
              referrerPolicy="strict-origin-when-cross-origin"
              className="min-h-0 w-full flex-1 rounded-md border border-[color:var(--workspace-shell-border)] bg-white"
            />
            {embed.provider === 'google' ? (
              <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                Sign in to Google in this browser to edit. If the document stays
                blank, use “Open original”.
              </p>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
