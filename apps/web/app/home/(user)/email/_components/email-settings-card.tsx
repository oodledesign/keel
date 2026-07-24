'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2, Mail, Unplug } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';

import {
  disconnectGmailConnection,
  saveEmailAssistantSettings,
} from '../_lib/actions/email-assistant-actions';
import {
  EmailSignatureField,
  type EmailSignatureFormat,
} from './email-signature-field';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4 md:p-5';

type Props = {
  connectedEmail: string | null;
  mailboxKind?: 'business' | 'personal';
  returnPath?: string;
  initialStyleNotes: string;
  initialSignature: string;
  initialSignatureIsHtml: boolean;
  initialAutoTriageEnabled: boolean;
  initialAutoDraftEnabled: boolean;
  initialAutoSaveGmailDrafts: boolean;
  lastSyncedAt: string | null;
};

function formatSyncedAt(value: string | null) {
  if (!value) {
    return 'Never synced';
  }

  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SettingToggle({
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

export function EmailSettingsCard({
  connectedEmail,
  mailboxKind = 'personal',
  returnPath = pathsConfig.app.personalEmailAssistant,
  initialStyleNotes,
  initialSignature,
  initialSignatureIsHtml,
  initialAutoTriageEnabled,
  initialAutoDraftEnabled,
  initialAutoSaveGmailDrafts,
  lastSyncedAt,
}: Props) {
  const [styleNotes, setStyleNotes] = useState(initialStyleNotes);
  const [signature, setSignature] = useState(initialSignature);
  const [signatureFormat, setSignatureFormat] = useState<EmailSignatureFormat>(
    initialSignatureIsHtml ? 'html' : 'plain',
  );
  const [autoTriageEnabled, setAutoTriageEnabled] = useState(
    initialAutoTriageEnabled,
  );
  const [autoDraftEnabled, setAutoDraftEnabled] = useState(
    initialAutoDraftEnabled,
  );
  const [autoSaveGmailDrafts, setAutoSaveGmailDrafts] = useState(
    initialAutoSaveGmailDrafts,
  );
  const [pending, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    setStyleNotes(initialStyleNotes);
    setSignature(initialSignature);
    setSignatureFormat(initialSignatureIsHtml ? 'html' : 'plain');
    setAutoTriageEnabled(initialAutoTriageEnabled);
    setAutoDraftEnabled(initialAutoDraftEnabled);
    setAutoSaveGmailDrafts(initialAutoSaveGmailDrafts);
  }, [
    initialStyleNotes,
    initialSignature,
    initialSignatureIsHtml,
    initialAutoTriageEnabled,
    initialAutoDraftEnabled,
    initialAutoSaveGmailDrafts,
  ]);

  const connectHref = `/api/google/connect?mailbox=${mailboxKind}&returnPath=${encodeURIComponent(returnPath)}`;

  function saveSettings() {
    startTransition(async () => {
      const result = await saveEmailAssistantSettings({
        styleNotes,
        signature,
        signatureIsHtml: signatureFormat === 'html',
        autoTriageEnabled,
        autoDraftEnabled,
        autoSaveGmailDrafts,
        mailboxKind,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Could not save settings');
        return;
      }

      toast.success('Email assistant settings saved');
    });
  }

  function disconnect() {
    setDisconnecting(true);
    startTransition(async () => {
      try {
        const result = await disconnectGmailConnection({ mailboxKind });

        if (!result.success) {
          toast.error(result.error ?? 'Could not disconnect Gmail');
          return;
        }

        toast.success('Gmail disconnected');
      } finally {
        setDisconnecting(false);
      }
    });
  }

  return (
    <section className={panelClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Settings
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Connect Gmail and tune how drafts are written.
          </p>
        </div>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          Last sync: {formatSyncedAt(lastSyncedAt)}
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/60 p-4">
        {connectedEmail ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  Gmail connected
                </p>
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  {connectedEmail}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
              onClick={disconnect}
              disabled={disconnecting || pending}
            >
              {disconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting…
                </>
              ) : (
                <>
                  <Unplug className="mr-2 h-4 w-4" />
                  Disconnect
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Connect Gmail
              </p>
              <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                Sync your inbox and save drafts back to Gmail.
              </p>
            </div>
            <Button
              type="button"
              className="ozer-gradient-btn text-[var(--ozer-white)]"
              onClick={() => {
                window.location.href = connectHref;
              }}
            >
              Connect Gmail
            </Button>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <SettingToggle
          id="email-auto-triage"
          label="Auto-sort incoming mail"
          description="After each sync, Ozer labels threads that need a personal reply from you."
          checked={autoTriageEnabled}
          onCheckedChange={setAutoTriageEnabled}
          disabled={pending}
        />
        <SettingToggle
          id="email-auto-draft"
          label="Auto-draft replies"
          description="Draft replies for threads that need a response. Review them in Ozer before sending."
          checked={autoDraftEnabled}
          onCheckedChange={setAutoDraftEnabled}
          disabled={pending}
        />
        <SettingToggle
          id="email-auto-save-gmail"
          label="Save drafts to Gmail automatically"
          description="Push auto-drafts into Gmail as well as Ozer. Leave off if you prefer drafts only in Ozer."
          checked={autoSaveGmailDrafts}
          onCheckedChange={setAutoSaveGmailDrafts}
          disabled={pending || !autoDraftEnabled}
        />
      </div>

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="email-style-notes"
            className="text-[var(--workspace-shell-text-muted)]"
          >
            Writing style notes
          </Label>
          <Textarea
            id="email-style-notes"
            value={styleNotes}
            onChange={(event) => setStyleNotes(event.target.value)}
            placeholder="Warm and concise. Use first names. Always write and sign off as me, never as a recipient."
            rows={4}
            className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
          />
        </div>

        <EmailSignatureField
          signature={signature}
          format={signatureFormat}
          onSignatureChange={setSignature}
          onFormatChange={setSignatureFormat}
          disabled={pending}
        />

        <Button
          type="button"
          className="ozer-gradient-btn text-[var(--ozer-white)]"
          onClick={saveSettings}
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save settings'
          )}
        </Button>
      </div>
    </section>
  );
}
