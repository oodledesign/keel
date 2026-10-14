'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';

import {
  workspaceBorder,
  workspaceBtnPrimaryMd,
  workspaceCardHover,
  workspaceInfoBadge,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  listIgTestContacts,
  sendIgTestRun,
} from '../../_lib/server/instagram-sequence-actions';

type TestContact = Awaited<ReturnType<typeof listIgTestContacts>>[number];

const STORAGE_KEY = 'ozer-ig-test-contact';

const STATUS_COPY: Record<string, string> = {
  completed: 'Sent. Check your Instagram DMs.',
  waiting_reply: 'Sent. Tap a button or reply in Instagram to continue.',
  waiting_delay: 'Sent up to a wait step. The rest follows after the wait.',
  handed_off: 'Sent and handed to your team.',
  active: 'Started. Messages are on their way.',
};

export function SendTestDialog(props: {
  accountId: string;
  triggerId: string;
  businessUsername: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [contacts, setContacts] = useState<TestContact[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [sending, startSending] = useTransition();

  useEffect(() => {
    if (!props.open) return;
    startLoading(async () => {
      try {
        const list = await listIgTestContacts({ accountId: props.accountId });
        setContacts(list);
        const remembered = window.localStorage.getItem(STORAGE_KEY);
        setSelected(
          list.find((c) => c.id === remembered)?.id ??
            list.find((c) => c.windowOpen)?.id ??
            null,
        );
      } catch {
        setContacts([]);
      }
    });
  }, [props.open, props.accountId]);

  const send = () => {
    if (!selected) return;
    window.localStorage.setItem(STORAGE_KEY, selected);
    startSending(async () => {
      try {
        const result = await sendIgTestRun({
          accountId: props.accountId,
          triggerId: props.triggerId,
          contactId: selected,
        });
        if (result.status === 'failed' || result.status === 'window_expired') {
          toast.error(result.lastError ?? 'The test could not be sent');
        } else {
          toast.success(STATUS_COPY[result.status] ?? 'Test sent');
          props.onOpenChange(false);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Test failed');
      }
    });
  };

  const handle = props.businessUsername
    ? `@${props.businessUsername}`
    : 'your account';

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send to me</DialogTitle>
          <DialogDescription>
            Runs the saved version of this automation as a DM, so you can hear
            the voice note and tap the buttons yourself.
          </DialogDescription>
        </DialogHeader>

        <div className={`rounded-xl px-3 py-2 text-sm ${workspaceInfoBadge}`}>
          Instagram only lets you message people within 24 hours of their last
          message. From your personal Instagram, DM {handle} (anything, e.g.
          &ldquo;test&rdquo;), then choose yourself below.
        </div>

        {loading ? (
          <div
            className={`flex items-center gap-2 py-6 text-sm ${workspaceTextMuted}`}
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading recent conversations…
          </div>
        ) : contacts && contacts.length === 0 ? (
          <p className={`py-4 text-sm ${workspaceTextMuted}`}>
            No one has messaged {handle} yet. Send it a DM, then reopen this.
          </p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {(contacts ?? []).map((contact) => {
              const disabled = !contact.windowOpen || contact.optedOut;
              return (
                <button
                  key={contact.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelected(contact.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left disabled:opacity-50 ${workspaceBorder} ${workspaceCardHover} ${
                    selected === contact.id
                      ? 'ring-2 ring-[var(--ozer-accent)]'
                      : ''
                  }`}
                >
                  <span className={`text-sm ${workspaceText}`}>
                    {contact.username
                      ? `@${contact.username}`
                      : (contact.displayName ?? 'Instagram user')}
                  </span>
                  <span className={`text-xs ${workspaceTextMuted}`}>
                    {contact.optedOut
                      ? 'Opted out'
                      : contact.windowOpen
                        ? 'Can message'
                        : 'Over 24 hours ago'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            className={workspaceBtnPrimaryMd}
            disabled={!selected || sending}
            onClick={send}
          >
            {sending ? 'Sending…' : 'Send test'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
