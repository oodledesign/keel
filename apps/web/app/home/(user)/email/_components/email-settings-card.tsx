'use client';

import { useEffect, useState, useTransition } from 'react';

import { Loader2, Mail, Unplug } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

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
  'rounded-2xl border border-white/[0.08] bg-[var(--workspace-shell-panel)] p-4 md:p-5';

type Props = {
  connectedEmail: string | null;
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
    <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-[#0B132B]/60 p-4">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium text-white">
          {label}
        </Label>
        <p className="text-xs text-zinc-500">{description}</p>
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

  const connectHref = `/api/google/connect?returnPath=${encodeURIComponent(pathsConfig.app.personalEmailAssistant)}`;

  function saveSettings() {
    startTransition(async () => {
      const result = await saveEmailAssistantSettings({
        styleNotes,
        signature,
        signatureIsHtml: signatureFormat === 'html',
        autoTriageEnabled,
        autoDraftEnabled,
        autoSaveGmailDrafts,
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
        const result = await disconnectGmailConnection();

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
          <h2 className="text-base font-semibold text-white">Settings</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Connect Gmail and tune how drafts are written.
          </p>
        </div>
        <p className="text-xs text-zinc-500">Last sync: {formatSyncedAt(lastSyncedAt)}</p>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-[#0B132B]/60 p-4">
        {connectedEmail ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--keel-teal)]/15 text-[var(--keel-teal)]">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Gmail connected</p>
                <p className="text-sm text-zinc-400">{connectedEmail}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-white/10 bg-transparent text-white hover:bg-white/5"
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
              <p className="text-sm font-medium text-white">Connect Gmail</p>
              <p className="text-sm text-zinc-400">
                Sync your inbox and save drafts back to Gmail.
              </p>
            </div>
            <Button
              type="button"
              className="keel-gradient-btn text-white"
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
          <Label htmlFor="email-style-notes" className="text-zinc-300">
            Writing style notes
          </Label>
          <Textarea
            id="email-style-notes"
            value={styleNotes}
            onChange={(event) => setStyleNotes(event.target.value)}
            placeholder="Warm and concise. Use first names. Always write and sign off as me, never as a recipient."
            rows={4}
            className="border-white/10 bg-[#0B132B] text-white placeholder:text-zinc-500"
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
          className="keel-gradient-btn text-white"
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
