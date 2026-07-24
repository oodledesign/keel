'use client';

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
import { cn } from '@kit/ui/utils';

type DisconnectIntegrationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  consequences: string[];
  confirmLabel?: string;
  confirming?: boolean;
  onConfirm: () => void;
};

export function DisconnectIntegrationDialog({
  open,
  onOpenChange,
  title,
  description,
  consequences,
  confirmLabel = 'Disconnect',
  confirming = false,
  onConfirm,
}: DisconnectIntegrationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-[var(--workspace-shell-text-muted)]">
              <p>{description}</p>
              {consequences.length > 0 ? (
                <ul className="list-disc space-y-1.5 pl-5 text-left">
                  {consequences.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
            disabled={confirming}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              'bg-[#C4455C] text-white hover:bg-[#C4455C]/90',
              confirming && 'pointer-events-none opacity-70',
            )}
            disabled={confirming}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {confirming ? 'Disconnecting…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const GMAIL_DISCONNECT_CONSEQUENCES = [
  'Synced inbox threads, messages, drafts, and suggested to-dos for this mailbox will be deleted from Ozer',
  'Email assistant settings for this connection (style notes, signature, sync preferences) will be removed',
  'Your Gmail account itself is unchanged — only the Ozer link is removed',
  'You can reconnect later and sync again from Gmail',
] as const;

export const GOOGLE_CALENDAR_DISCONNECT_CONSEQUENCES = [
  'Ozer will stop reading free/busy from this Google account',
  'Planner scheduling, booking availability, and Meet links that rely on it may be incomplete until you reconnect',
  'Existing tasks and planner items in Ozer are kept',
  'Your Google Calendar itself is unchanged',
] as const;
