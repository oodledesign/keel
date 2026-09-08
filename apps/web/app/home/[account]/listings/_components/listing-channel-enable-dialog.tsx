'use client';

import Link from 'next/link';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

import type { ChannelPublishBlocker } from '~/lib/commercial/channel-publish-blockers';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

export function ListingChannelEnableDialog({
  open,
  onOpenChange,
  channelLabel,
  blockers,
  canContinue,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelLabel: string;
  blockers: ChannelPublishBlocker[];
  canContinue: boolean;
  onContinue?: () => void;
}) {
  const required = blockers.filter((item) => item.severity === 'required');
  const checklist = blockers.filter((item) => item.severity === 'checklist');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
        data-test="channel-enable-dialog"
      >
        <DialogHeader>
          <DialogTitle>Finish these to publish to {channelLabel}</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            {canContinue
              ? 'This disposal is not fully marketing-ready. Fix the items below, or continue anyway.'
              : 'This channel cannot go live yet. Complete the steps below, then try the switch again.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {required.length > 0 ? (
            <BlockerList
              heading="Required to enable"
              items={required}
              onNavigate={() => onOpenChange(false)}
            />
          ) : null}
          {checklist.length > 0 ? (
            <BlockerList
              heading={
                required.length > 0
                  ? 'Also on the publishing checklist'
                  : 'Publishing checklist'
              }
              items={checklist}
              onNavigate={() => onOpenChange(false)}
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {canContinue ? (
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              onClick={() => {
                onOpenChange(false);
                onContinue?.();
              }}
            >
              Continue anyway
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlockerList({
  heading,
  items,
  onNavigate,
}: {
  heading: string;
  items: ChannelPublishBlocker[];
  onNavigate: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
        {heading}
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2.5"
          >
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              {item.label}
            </p>
            <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
              {item.hint}
            </p>
            {item.href && item.actionLabel ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={onNavigate}
              >
                <Link href={item.href}>{item.actionLabel}</Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
