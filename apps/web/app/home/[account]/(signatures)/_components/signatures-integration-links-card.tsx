'use client';

import { useMemo, useState, useTransition } from 'react';

import { Check, Copy, Link2, Loader2, Mail, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import {
  buildSignaturesAdminInviteEmail,
  providerLabel,
} from '~/lib/signatures/admin-invite-email';

import {
  createSignaturesIntegrationInvite,
  revokeSignaturesIntegrationInvite,
} from '../_lib/server/signatures-module-actions';

type IntegrationConnectInvite = {
  id: string;
  account_id: string;
  provider: 'microsoft' | 'google';
  label: string | null;
  created_by: string | null;
  expires_at: string;
  used_at: string | null;
  used_by_email: string | null;
  revoked_at: string | null;
  created_at: string;
};

type Props = {
  accountId: string;
  accountName: string;
  initialInvites: IntegrationConnectInvite[];
};

export function SignaturesIntegrationLinksCard({
  accountId,
  accountName,
  initialInvites,
}: Props) {
  const [invites, setInvites] = useState(initialInvites);
  const [provider, setProvider] = useState<'microsoft' | 'google'>('microsoft');
  const [label, setLabel] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedProvider, setGeneratedProvider] = useState<
    'microsoft' | 'google' | null
  >(null);
  const [generatedExpiresAt, setGeneratedExpiresAt] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState<'link' | 'email' | 'subject' | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const activeInvites = invites.filter(
    (invite) => !invite.used_at && !invite.revoked_at,
  );

  const emailTemplate = useMemo(() => {
    if (!generatedUrl || !generatedProvider) {
      return null;
    }

    return buildSignaturesAdminInviteEmail({
      accountName,
      provider: generatedProvider,
      url: generatedUrl,
      expiresAt: generatedExpiresAt,
    });
  }, [accountName, generatedExpiresAt, generatedProvider, generatedUrl]);

  const generate = () => {
    startTransition(async () => {
      try {
        const result = await createSignaturesIntegrationInvite({
          accountId,
          provider,
          label: label.trim() || undefined,
        });
        setGeneratedUrl(result.url);
        setGeneratedProvider(result.provider);
        setGeneratedExpiresAt(result.expiresAt);
        setCopied(null);
        setInvites((prev) => [
          {
            id: result.inviteId,
            account_id: accountId,
            provider: result.provider,
            label: label.trim() || null,
            created_by: null,
            expires_at: result.expiresAt,
            used_at: null,
            used_by_email: null,
            revoked_at: null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        toast.success('Integration link created');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const revoke = (inviteId: string) => {
    startTransition(async () => {
      try {
        await revokeSignaturesIntegrationInvite({ accountId, inviteId });
        setInvites((prev) =>
          prev.map((invite) =>
            invite.id === inviteId
              ? { ...invite, revoked_at: new Date().toISOString() }
              : invite,
          ),
        );
        toast.success('Link revoked');
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const markCopied = (kind: 'link' | 'email' | 'subject') => {
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyUrl = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    markCopied('link');
    toast.success('Link copied');
  };

  const copyEmailBody = async () => {
    if (!emailTemplate) return;
    await navigator.clipboard.writeText(emailTemplate.body);
    markCopied('email');
    toast.success('Email copied — paste into your mail app');
  };

  const copySubject = async () => {
    if (!emailTemplate) return;
    await navigator.clipboard.writeText(emailTemplate.subject);
    markCopied('subject');
    toast.success('Subject copied');
  };

  const copyFullEmail = async () => {
    if (!emailTemplate) return;
    await navigator.clipboard.writeText(
      `Subject: ${emailTemplate.subject}\n\n${emailTemplate.body}`,
    );
    markCopied('email');
    toast.success('Email copied — paste into your mail app');
  };

  return (
    <Card className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
      <CardHeader>
        <CardTitle>Share with IT admin</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Generate a secure one-time link for your Google Workspace or Microsoft
          365 administrator. They can complete the connection without a Ozer
          account — you keep managing signatures in Ozer.
        </p>

        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)_auto]">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(value) =>
                setProvider(value as 'microsoft' | 'google')
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="microsoft">Microsoft 365</SelectItem>
                <SelectItem value="google">Google Workspace</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-label">Label (optional)</Label>
            <Input
              id="invite-label"
              placeholder="e.g. Send to IT — March setup"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={generate} disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 h-4 w-4" />
              )}
              Generate link
            </Button>
          </div>
        </div>

        {generatedUrl && emailTemplate ? (
          <div className="space-y-4 rounded-2xl border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent)]/5 p-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--ozer-accent-muted)]">
                Copy and send this link
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-xs text-[var(--workspace-shell-text)]">
                  {generatedUrl}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={copyUrl}
                >
                  {copied === 'link' ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied === 'link' ? 'Copied' : 'Copy link'}
                </Button>
              </div>
            </div>

            <div className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--ozer-accent-muted)]">
                  Email to paste
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={copySubject}
                  >
                    {copied === 'subject' ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {copied === 'subject' ? 'Copied' : 'Copy subject'}
                  </Button>
                  <Button type="button" size="sm" onClick={copyFullEmail}>
                    {copied === 'email' ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    {copied === 'email' ? 'Copied' : 'Copy email'}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-invite-subject">Subject</Label>
                <Input
                  id="admin-invite-subject"
                  readOnly
                  value={emailTemplate.subject}
                  className="bg-black/10 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-invite-body">Message</Label>
                <Textarea
                  id="admin-invite-body"
                  readOnly
                  value={emailTemplate.body}
                  className="min-h-[220px] bg-black/10 text-sm leading-relaxed"
                />
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copyEmailBody}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy message only
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Expires in 7 days. Single use. Do not share publicly.
            </p>
          </div>
        ) : null}

        {activeInvites.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-black/10 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
              Active links
            </p>
            <ul className="space-y-2">
              {activeInvites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {invite.label || providerLabel(invite.provider)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {providerLabel(invite.provider)} · expires{' '}
                      {new Date(invite.expires_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => revoke(invite.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
