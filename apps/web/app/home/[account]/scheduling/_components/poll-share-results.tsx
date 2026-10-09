'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

import {
  disableMeetingPollResultsLinkAction,
  emailMeetingPollResultsLinkAction,
  enableMeetingPollResultsLinkAction,
} from '../_lib/server/meeting-poll-actions';

const FIELD =
  'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]';

/** View-only results link for whoever makes the final call on the time. */
export function PollShareResults({
  accountId,
  accountSlug,
  pollId,
  resultsUrl,
}: {
  accountId: string;
  accountSlug: string;
  pollId: string;
  resultsUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const ids = { accountId, accountSlug, pollId };

  function enable() {
    startTransition(async () => {
      const result = await enableMeetingPollResultsLinkAction(ids);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.refresh();
    });
  }

  function disable() {
    startTransition(async () => {
      const result = await disableMeetingPollResultsLinkAction(ids);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success('Link turned off. The old link no longer works.');
      router.refresh();
    });
  }

  function sendEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      const result = await emailMeetingPollResultsLinkAction({
        ...ids,
        email: email.trim(),
        name: name.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Sent to ${email.trim()}`);
      setEmail('');
      setName('');
      router.refresh();
    });
  }

  async function copy() {
    if (!resultsUrl) return;
    try {
      await navigator.clipboard.writeText(resultsUrl);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy. Select the link and copy it instead.');
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[color:var(--workspace-shell-border)] p-4">
      <div>
        <h3 className="text-lg font-semibold">Share availability</h3>
        <p className={`text-sm ${workspaceTextMuted}`}>
          A view-only page with everyone&apos;s answers and names, for whoever
          is choosing the final time. They do not need an Ozer account.
        </p>
      </div>

      {resultsUrl ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              readOnly
              value={resultsUrl}
              aria-label="Availability link"
              onFocus={(event) => event.currentTarget.select()}
              className={`min-w-0 flex-1 ${FIELD}`}
            />
            <Button type="button" variant="outline" onClick={copy}>
              Copy link
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={disable}
            >
              Turn off link
            </Button>
          </div>

          <form
            onSubmit={sendEmail}
            className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div className="space-y-1">
              <Label htmlFor="poll-results-name">Their name (optional)</Label>
              <Input
                id="poll-results-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={FIELD}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="poll-results-email">Email it to</Label>
              <Input
                id="poll-results-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                className={FIELD}
              />
            </div>
            <button
              type="submit"
              className={workspaceBtnPrimaryMd}
              disabled={pending || !email.trim()}
            >
              Send link
            </button>
          </form>
          <p className={`text-xs ${workspaceTextMuted}`}>
            Anyone with the link can see every answer. Turning it off stops the
            current link working; creating a new one gives a fresh link.
          </p>
        </>
      ) : (
        <button
          type="button"
          className={workspaceBtnPrimaryMd}
          disabled={pending}
          onClick={enable}
        >
          Create availability link
        </button>
      )}
    </section>
  );
}
