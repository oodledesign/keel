'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { toast } from '@kit/ui/sonner';

import { completeEmailOnboarding } from '../_lib/actions/email-assistant-actions';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailboxKind: 'business' | 'personal';
  onCompleted?: () => void;
};

type StepId =
  | 'welcome'
  | 'sync'
  | 'respect'
  | 'drafts'
  | 'send'
  | 'done';

const STEPS: StepId[] = ['welcome', 'sync', 'respect', 'drafts', 'send', 'done'];

function StepToggle({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/60 p-4">
      <div className="space-y-1">
        <Label
          htmlFor={id}
          className="text-sm font-medium text-[var(--workspace-shell-text)]"
        >
          {label}
        </Label>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

export function EmailOnboardingDialog({
  open,
  onOpenChange,
  mailboxKind,
  onCompleted,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [syncTriageToGmail, setSyncTriageToGmail] = useState(false);
  const [respectExistingGmailLabels, setRespectExistingGmailLabels] =
    useState(true);
  const [autoDraftEnabled, setAutoDraftEnabled] = useState(false);
  const [autoSaveGmailDrafts, setAutoSaveGmailDrafts] = useState(false);
  const [allowSendFromOzer, setAllowSendFromOzer] = useState(false);
  const [pending, startTransition] = useTransition();
  const finishingRef = useRef(false);

  useEffect(() => {
    if (open) {
      finishingRef.current = false;
    }
  }, [open]);

  const step = STEPS[stepIndex] ?? 'welcome';
  const isLast = step === 'done';
  const progressLabel = useMemo(
    () => `Step ${stepIndex + 1} of ${STEPS.length}`,
    [stepIndex],
  );

  function finish(skipped: boolean) {
    if (finishingRef.current) {
      return;
    }
    finishingRef.current = true;
    startTransition(async () => {
      const result = await completeEmailOnboarding({
        mailboxKind,
        syncTriageToGmail: skipped ? false : syncTriageToGmail,
        respectExistingGmailLabels,
        autoDraftEnabled: skipped ? false : autoDraftEnabled,
        autoSaveGmailDrafts: skipped
          ? false
          : autoDraftEnabled && autoSaveGmailDrafts,
        allowSendFromOzer: skipped ? false : allowSendFromOzer,
        skipped,
      });

      if (!result.success) {
        finishingRef.current = false;
        toast.error(result.error ?? 'Could not save email setup');
        return;
      }

      toast.success(
        skipped ? 'You can finish email setup anytime in Settings' : 'Email setup complete',
      );
      onCompleted?.();
      setStepIndex(0);
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) {
          // Dismiss without going through Finish still records completion as skipped.
          finish(true);
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
            {progressLabel}
          </p>
          <DialogTitle>
            {step === 'welcome' && 'Set up email with Ozer'}
            {step === 'sync' && 'Triage in Gmail'}
            {step === 'respect' && 'Respect your labels'}
            {step === 'drafts' && 'Draft replies'}
            {step === 'send' && 'Send from Ozer'}
            {step === 'done' && 'You are ready'}
          </DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            {step === 'welcome' &&
              'Ozer can organise mail with Ozer/* labels, optionally archive low-priority threads, and never delete messages. You stay in control of every setting.'}
            {step === 'sync' &&
              'When enabled, Ozer writes triage labels into Gmail. Waiting, FYI, and Noise leave Inbox; Reply now and Reply later stay there.'}
            {step === 'respect' &&
              'If a thread already has one of your Gmail labels, Ozer will keep triage in Ozer only and skip auto-filing that thread.'}
            {step === 'drafts' &&
              'Auto-drafts are off by default. Turn them on only if you want Ozer to prepare replies after sync.'}
            {step === 'send' &&
              'Sending from Ozer is optional and always requires your confirmation on each message.'}
            {step === 'done' &&
              'We will sync your mailbox next. Open Action in the inbox filter to work through what needs a reply.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {step === 'sync' ? (
            <StepToggle
              id="onboarding-sync-triage"
              label="Apply triage in Gmail"
              description="Write Ozer/* labels and archive Waiting / FYI / Noise when sync is on."
              checked={syncTriageToGmail}
              onCheckedChange={setSyncTriageToGmail}
              disabled={pending}
            />
          ) : null}

          {step === 'respect' ? (
            <StepToggle
              id="onboarding-respect-labels"
              label="Respect my existing labels"
              description="Skip auto-file when a thread already has a non-Ozer user label."
              checked={respectExistingGmailLabels}
              onCheckedChange={setRespectExistingGmailLabels}
              disabled={pending}
            />
          ) : null}

          {step === 'drafts' ? (
            <>
              <StepToggle
                id="onboarding-auto-draft"
                label="Auto-draft replies"
                description="Draft replies for Reply now threads after sync. Review before sending."
                checked={autoDraftEnabled}
                onCheckedChange={(checked) => {
                  setAutoDraftEnabled(checked);
                  if (!checked) {
                    setAutoSaveGmailDrafts(false);
                  }
                }}
                disabled={pending}
              />
              <StepToggle
                id="onboarding-auto-save-gmail"
                label="Save drafts to Gmail"
                description="Also push auto-drafts into Gmail. Only available when auto-draft is on."
                checked={autoSaveGmailDrafts}
                onCheckedChange={setAutoSaveGmailDrafts}
                disabled={pending || !autoDraftEnabled}
              />
            </>
          ) : null}

          {step === 'send' ? (
            <StepToggle
              id="onboarding-allow-send"
              label="Send from Ozer"
              description="Show a Send button on drafts after you review the preview."
              checked={allowSendFromOzer}
              onCheckedChange={setAllowSendFromOzer}
              disabled={pending}
            />
          ) : null}

          {step === 'welcome' || step === 'done' ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              {step === 'welcome'
                ? 'Privacy note: with Gmail sync on, Ozer may apply Ozer/* labels and archive some categories. It never deletes your mail.'
                : 'You can change any of these later in Email settings.'}
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-[var(--workspace-shell-text-muted)]"
            onClick={() => finish(true)}
            disabled={pending}
          >
            I will set this up later
          </Button>
          <div className="flex gap-2">
            {stepIndex > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)] bg-transparent"
                onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
                disabled={pending}
              >
                Back
              </Button>
            ) : null}
            {isLast ? (
              <Button
                type="button"
                className="ozer-gradient-btn text-[var(--ozer-white)]"
                onClick={() => finish(false)}
                disabled={pending}
              >
                {pending ? 'Saving…' : 'Finish and sync'}
              </Button>
            ) : (
              <Button
                type="button"
                className="ozer-gradient-btn text-[var(--ozer-white)]"
                onClick={() =>
                  setStepIndex((value) => Math.min(STEPS.length - 1, value + 1))
                }
                disabled={pending}
              >
                Continue
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
