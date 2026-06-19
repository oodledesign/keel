'use client';

import { useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

import { PlatformSupportTicketForm } from '~/home/(user)/support/_components/platform-support-ticket-form';
import {
  loadPlatformSupportAccountOptions,
  type PlatformSupportAccountOption,
} from '~/lib/support/load-platform-support-account-options';

type PlatformSupportTicketDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountId?: string | null;
};

export function PlatformSupportTicketDialog({
  open,
  onOpenChange,
  defaultAccountId = null,
}: PlatformSupportTicketDialogProps) {
  const [accountOptions, setAccountOptions] = useState<
    PlatformSupportAccountOption[]
  >([]);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void loadPlatformSupportAccountOptions()
      .then((options) => {
        if (!cancelled) {
          setAccountOptions(options);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccountOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setFormKey((value) => value + 1);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Help &amp; feedback</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Contact the Ozer team about billing, bugs, or product questions.
          </DialogDescription>
        </DialogHeader>

        <PlatformSupportTicketForm
          key={formKey}
          accountOptions={accountOptions}
          defaultAccountId={defaultAccountId}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
