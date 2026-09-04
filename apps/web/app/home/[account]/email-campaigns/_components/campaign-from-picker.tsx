'use client';

import { type ChangeEvent } from 'react';

import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';

import {
  DEFAULT_SENDING_LOCAL_PART,
  DEFAULT_SENDING_LOCAL_PARTS,
} from '~/lib/sending-domains';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

export type CampaignSendingDomainOption = {
  verified: boolean;
  sendingHost: string;
  defaultLocalPart: string;
  domain: string;
};

function chipClass(active: boolean) {
  return cn(
    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
    active
      ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
      : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
  );
}

function localPartFromEmail(email: string | null | undefined, host: string) {
  const value = email?.trim().toLowerCase() ?? '';
  const suffix = `@${host}`;
  if (value.endsWith(suffix)) {
    return value.slice(0, -suffix.length);
  }
  return '';
}

export function CampaignFromPicker({
  sendingDomain,
  fromName,
  fromEmail,
  replyTo,
  disabled,
  fallbackFromLabel,
  onFromNameChange,
  onFromEmailChange,
  onReplyToChange,
}: {
  sendingDomain: CampaignSendingDomainOption | null;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  disabled: boolean;
  fallbackFromLabel: string | null;
  onFromNameChange: (value: string) => void;
  onFromEmailChange: (value: string) => void;
  onReplyToChange: (value: string) => void;
}) {
  if (!sendingDomain?.verified) {
    return (
      <div className="space-y-2">
        <Label>From</Label>
        <p className={`text-sm ${workspaceTextMuted}`}>
          {fallbackFromLabel
            ? `Sends as ${fallbackFromLabel} until a sending domain is connected.`
            : 'Connect and verify a sending domain in Settings to choose a custom From address.'}
        </p>
      </div>
    );
  }

  const host = sendingDomain.sendingHost;
  const localPart =
    localPartFromEmail(fromEmail, host) ||
    sendingDomain.defaultLocalPart ||
    DEFAULT_SENDING_LOCAL_PART;

  const setLocalPart = (next: string) => {
    const cleaned = next.trim().toLowerCase().replace(/@.*$/, '');
    onFromEmailChange(cleaned ? `${cleaned}@${host}` : '');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="campaign-from-name">From name</Label>
        <Input
          id="campaign-from-name"
          data-test="campaign-from-name"
          value={fromName}
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onFromNameChange(event.target.value)
          }
          placeholder="Workspace name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="campaign-from-local">From address</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="campaign-from-local"
            data-test="campaign-from-local"
            className="max-w-[12rem]"
            value={localPart}
            disabled={disabled}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setLocalPart(event.target.value)
            }
          />
          <span className={`text-sm ${workspaceTextMuted}`}>@{host}</span>
        </div>
        <div
          data-test="campaign-from-local-chips"
          className="flex flex-wrap gap-1.5"
        >
          {DEFAULT_SENDING_LOCAL_PARTS.map((part) => (
            <button
              key={part}
              type="button"
              data-test={`campaign-from-chip-${part}`}
              className={chipClass(localPart === part)}
              disabled={disabled}
              onClick={() => setLocalPart(part)}
            >
              {part}
            </button>
          ))}
        </div>
        <p className={`text-sm ${workspaceTextMuted}`}>
          Replies go to this From address unless you set Reply-To. Prefer a
          mailbox your team monitors — addresses like{' '}
          <span className={workspaceText}>no-reply</span> will not receive
          replies.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="campaign-reply-to">Reply-To (optional)</Label>
        <Input
          id="campaign-reply-to"
          data-test="campaign-reply-to"
          type="email"
          value={replyTo}
          disabled={disabled}
          placeholder="team@your-domain.com"
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onReplyToChange(event.target.value)
          }
        />
      </div>
    </div>
  );
}
