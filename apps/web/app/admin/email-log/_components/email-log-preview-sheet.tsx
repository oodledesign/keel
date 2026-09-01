'use client';

import { useEffect, useState } from 'react';

import { Eye, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@kit/ui/sheet';

import { getPlatformEmailPreviewAction } from '../_lib/server/admin-email-log-preview.actions';

type PreviewPayload = {
  id: string;
  emailType: string;
  subject: string;
  recipientEmail: string;
  senderEmail: string | null;
  status: string;
  htmlBody: string | null;
  createdAt: string;
};

export function EmailLogPreviewButton({ emailLogId }: { emailLogId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Eye className="h-3.5 w-3.5" />
        Preview
      </Button>
      {open ? (
        <EmailLogPreviewSheet
          key={emailLogId}
          emailLogId={emailLogId}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}

function EmailLogPreviewSheet({
  emailLogId,
  open,
  onOpenChange,
}: {
  emailLogId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    void getPlatformEmailPreviewAction({ emailLogId })
      .then((payload) => {
        if (cancelled) return;
        setPreview(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Could not load email preview',
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [emailLogId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0 text-[var(--workspace-shell-text)] sm:max-w-3xl"
      >
        <SheetHeader className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-5 py-4 text-left">
          <SheetTitle className="text-[var(--workspace-shell-text)]">
            {preview?.subject ?? 'Email preview'}
          </SheetTitle>
          <SheetDescription className="text-[var(--workspace-shell-text-muted)]">
            {preview
              ? `${preview.emailType.replace(/_/g, ' ')} · ${preview.recipientEmail}`
              : 'Rendered outbound email'}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4">
          {loading ? (
            <div className="flex items-center gap-2 py-12 text-sm text-[var(--workspace-shell-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading preview…
            </div>
          ) : error ? (
            <p className="py-12 text-sm text-rose-500">{error}</p>
          ) : preview?.htmlBody ? (
            <iframe
              title="Email HTML preview"
              sandbox=""
              className="h-[min(80vh,900px)] w-full rounded-lg border border-neutral-200 bg-white"
              srcDoc={preview.htmlBody}
            />
          ) : (
            <p className="py-12 text-sm text-neutral-600">
              No HTML was stored for this send. New sends (including circulation)
              keep a preview going forward.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
