'use client';

import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';

export function ConfirmSendEmailDialog({
  open,
  onOpenChange,
  title = 'Send this email?',
  description,
  documentLabel,
  recipients,
  subject,
  confirmLabel = 'Send',
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  documentLabel: string;
  recipients: string[];
  subject?: string | null;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const hasRecipients = recipients.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[var(--workspace-shell-text)]">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[var(--workspace-shell-text-muted)]">
            {description ??
              `${documentLabel} will be emailed now. Check the recipient before sending.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              Sending
            </dt>
            <dd className="mt-1 font-medium text-[var(--workspace-shell-text)]">
              {documentLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              To
            </dt>
            <dd className="mt-1 text-[var(--workspace-shell-text)]">
              {hasRecipients ? (
                <ul className="space-y-0.5">
                  {recipients.map((email) => (
                    <li key={email.toLowerCase()} className="break-all">
                      {email}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-destructive">No recipient on file</span>
              )}
            </dd>
          </div>
          {subject?.trim() ? (
            <div>
              <dt className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                Subject
              </dt>
              <dd className="mt-1 text-[var(--workspace-shell-text)]">
                {subject.trim()}
              </dd>
            </div>
          ) : null}
        </dl>

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={pending}
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
          >
            Cancel
          </AlertDialogCancel>
          <Button
            type="button"
            disabled={pending || !hasRecipients}
            data-test="confirm-send-email"
            className="bg-[var(--ozer-accent)] text-[var(--ozer-text-on-dark)] hover:bg-[var(--ozer-accent-hover)]"
            onClick={onConfirm}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
