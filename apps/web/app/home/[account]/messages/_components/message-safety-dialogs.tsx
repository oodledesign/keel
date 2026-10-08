'use client';

import { useState, useTransition } from 'react';

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
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { RadioGroup, RadioGroupItem } from '@kit/ui/radio-group';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import {
  MESSAGE_REPORT_REASONS,
  MESSAGE_REPORT_REASON_LABELS,
  type MessageReportReason,
} from '~/lib/messages/message-safety-shared';
import { workspaceBtnPrimary } from '~/lib/workspace-ui';

import {
  blockChatUserAction,
  reportChatMessageAction,
} from '../_lib/server/server-actions';

export type ChatPerson = { userId: string; name: string };

export type ChatReportTarget = {
  threadId: string;
  messageId?: string;
  person: ChatPerson | null;
};

const dialogClassName =
  'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-md';

export function ReportChatDialog(props: {
  accountId: string;
  target: ChatReportTarget | null;
  onOpenChange: (open: boolean) => void;
  onBlocked: (userId: string) => void;
}) {
  const [reason, setReason] = useState<MessageReportReason>('spam');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [pending, startTransition] = useTransition();
  const target = props.target;
  const isMessage = Boolean(target?.messageId);

  function close() {
    props.onOpenChange(false);
    setReason('spam');
    setDetails('');
    setAlsoBlock(false);
  }

  function submit() {
    if (!target) return;
    startTransition(async () => {
      const result = await reportChatMessageAction({
        accountId: props.accountId,
        threadId: target.threadId,
        messageId: target.messageId,
        reason,
        details,
        block: alsoBlock && Boolean(target.person),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.blocked && target.person
          ? `Thanks. We'll review this within 24 hours. You've blocked ${target.person.name}.`
          : "Thanks. We'll review this within 24 hours.",
      );
      close();
      if (result.blocked_user_id) {
        props.onBlocked(result.blocked_user_id);
      }
    });
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => (open ? null : close())}
    >
      <DialogContent className={dialogClassName}>
        <DialogHeader>
          <DialogTitle>
            {isMessage ? 'Report message' : 'Report conversation'}
          </DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            The Ozer team reviews every report within 24 hours and removes
            content or people that break our terms.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={reason}
          onValueChange={(value) => setReason(value as MessageReportReason)}
          className="gap-2"
        >
          {MESSAGE_REPORT_REASONS.map((value) => (
            <Label
              key={value}
              htmlFor={`report-reason-${value}`}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2.5 text-sm font-normal"
            >
              <RadioGroupItem value={value} id={`report-reason-${value}`} />
              {MESSAGE_REPORT_REASON_LABELS[value]}
            </Label>
          ))}
        </RadioGroup>

        <div className="space-y-1.5">
          <Label htmlFor="report-details" className="text-sm">
            Details (optional)
          </Label>
          <Textarea
            id="report-details"
            value={details}
            maxLength={2000}
            rows={3}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Anything that helps us review it"
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]"
          />
        </div>

        {target?.person ? (
          <Label className="flex cursor-pointer items-start gap-3 text-sm font-normal">
            <Checkbox
              checked={alsoBlock}
              onCheckedChange={(checked) => setAlsoBlock(checked === true)}
              className="mt-0.5"
            />
            <span>
              Also block {target.person.name}
              <span className="block text-xs text-[var(--workspace-shell-text-muted)]">
                You won&apos;t see their messages or get notifications from
                them. They aren&apos;t told.
              </span>
            </span>
          </Label>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            className={cn('border-0', workspaceBtnPrimary)}
            disabled={pending}
            onClick={submit}
          >
            {pending ? 'Sending…' : 'Send report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BlockChatPersonDialog(props: {
  person: ChatPerson | null;
  onOpenChange: (open: boolean) => void;
  onBlocked: (userId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const person = props.person;

  function block() {
    if (!person) return;
    startTransition(async () => {
      const result = await blockChatUserAction({ userId: person.userId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Blocked ${person.name}`);
      props.onOpenChange(false);
      props.onBlocked(person.userId);
    });
  }

  return (
    <AlertDialog open={person !== null} onOpenChange={props.onOpenChange}>
      <AlertDialogContent className={dialogClassName}>
        <AlertDialogHeader>
          <AlertDialogTitle>Block {person?.name}?</AlertDialogTitle>
          <AlertDialogDescription className="text-[var(--workspace-shell-text-muted)]">
            You won&apos;t see their messages or get notifications from them, on
            the web or in the apps. They aren&apos;t told. You can unblock them
            in Settings → Blocked people.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              block();
            }}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {pending ? 'Blocking…' : 'Block'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
