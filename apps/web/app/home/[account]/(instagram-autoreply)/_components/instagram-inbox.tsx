'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import {
  workspaceBorder,
  workspaceBtnPrimaryMd,
  workspaceFilterActive,
  workspaceInsetSurface,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  sendIgAgentReply,
  setIgConversationHandoff,
} from '../_lib/server/instagram-inbox-actions';

export type IgInboxConversation = {
  id: string;
  label: string;
  lastInboundAt: string | null;
  handedOff: boolean;
  optedOut: boolean;
};

export type IgInboxMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  eventType: string;
  body: string | null;
  sendStatus: string;
  createdAt: string;
};

const REFRESH_MS = 15_000;

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function windowLabel(lastInboundAt: string | null, now: number) {
  if (!lastInboundAt) return null;
  const remaining = Date.parse(lastInboundAt) + 24 * 60 * 60 * 1000 - now;
  if (remaining <= 0) return null;
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function messageLabel(m: IgInboxMessage) {
  if (m.direction === 'inbound') return null;
  if (m.eventType === 'agent') return 'You';
  if (m.eventType === 'system') return 'System';
  return 'Automation';
}

export function InstagramInbox(props: {
  accountId: string;
  inboxPath: string;
  conversations: IgInboxConversation[];
  selected: IgInboxConversation | null;
  messages: IgInboxMessage[];
  renderedAt: number;
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();
  const threadEnd = useRef<HTMLDivElement>(null);
  const draftNonce = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'end' });
  }, [props.messages.length, props.selected?.id]);

  const selected = props.selected;
  const remaining = selected
    ? windowLabel(selected.lastInboundAt, props.renderedAt)
    : null;
  const canReply = Boolean(selected && remaining && !selected.optedOut);

  const send = () => {
    if (!selected || !text.trim()) return;
    draftNonce.current ??= crypto.randomUUID();
    const nonce = draftNonce.current;
    startTransition(async () => {
      try {
        await sendIgAgentReply({
          accountId: props.accountId,
          contactId: selected.id,
          text: text.trim(),
          nonce,
        });
        draftNonce.current = null;
        setText('');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Send failed');
      }
    });
  };

  const toggleHandoff = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await setIgConversationHandoff({
          accountId: props.accountId,
          contactId: selected.id,
          handedOff: !selected.handedOff,
        });
        toast.success(
          selected.handedOff
            ? 'Automations will reply to them again'
            : 'Automations paused for this person',
        );
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Update failed');
      }
    });
  };

  return (
    <div className="mx-4 grid min-h-[32rem] gap-4 lg:mx-0 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className={`${workspacePanelCard} overflow-hidden`}>
        {props.conversations.length === 0 ? (
          <p className={`p-4 text-sm ${workspaceTextMuted}`}>
            No conversations yet. They appear here when someone messages you or
            an automation hands over to your team.
          </p>
        ) : (
          <ul className={`divide-y ${workspaceBorder}`}>
            {props.conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`${props.inboxPath}?contact=${c.id}`}
                  className={`flex flex-col gap-0.5 px-4 py-3 text-sm ${
                    selected?.id === c.id ? workspaceFilterActive : ''
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate font-medium ${workspaceText}`}>
                      {c.label}
                    </span>
                    {c.handedOff ? (
                      <span className="shrink-0 rounded-full bg-[var(--ozer-accent)] px-2 py-0.5 text-[10px] font-medium text-[var(--ozer-white)]">
                        Needs you
                      </span>
                    ) : null}
                  </span>
                  <span className={`text-xs ${workspaceTextMuted}`}>
                    {c.lastInboundAt
                      ? formatTime(c.lastInboundAt)
                      : 'No messages yet'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section
        className={`${workspacePanelCard} flex flex-col overflow-hidden`}
      >
        {!selected ? (
          <p className={`m-auto p-6 text-sm ${workspaceTextMuted}`}>
            Choose a conversation.
          </p>
        ) : (
          <>
            <header
              className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${workspaceBorder}`}
            >
              <div>
                <h2 className={`font-semibold ${workspaceText}`}>
                  {selected.label}
                </h2>
                <p className={`text-xs ${workspaceTextMuted}`}>
                  {selected.optedOut
                    ? 'Opted out of messages'
                    : remaining
                      ? `You can reply for another ${remaining}`
                      : 'The 24-hour reply window has closed'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={toggleHandoff}
              >
                {selected.handedOff ? 'Resume automation' : 'Take over'}
              </Button>
            </header>

            <div
              className="flex-1 space-y-2 overflow-y-auto p-4"
              style={{ maxHeight: '28rem' }}
            >
              {props.messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      m.direction === 'inbound'
                        ? `${workspaceInsetSurface} ${workspaceText}`
                        : 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                    }`}
                  >
                    <p className="break-words whitespace-pre-wrap">
                      {m.body ?? '[message]'}
                    </p>
                    <p className="mt-1 text-[10px] opacity-70">
                      {[messageLabel(m), formatTime(m.createdAt)]
                        .filter(Boolean)
                        .join(' · ')}
                      {m.direction === 'outbound' && m.sendStatus !== 'sent'
                        ? ` · ${m.sendStatus.replace('_', ' ')}`
                        : ''}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={threadEnd} />
            </div>

            <form
              className={`space-y-2 border-t p-3 ${workspaceBorder}`}
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <Textarea
                value={text}
                onChange={(e) => {
                  draftNonce.current = null;
                  setText(e.target.value);
                }}
                placeholder={
                  canReply
                    ? 'Write a reply…'
                    : 'Replies are unavailable right now'
                }
                disabled={!canReply || pending}
                maxLength={1000}
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs ${workspaceTextMuted}`}>
                  {selected.handedOff
                    ? 'Automations are paused while you handle this.'
                    : 'Replying here doesn’t pause automations. Take over to pause them.'}
                </span>
                <button
                  type="submit"
                  className={workspaceBtnPrimaryMd}
                  disabled={!canReply || pending || !text.trim()}
                >
                  Send
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
