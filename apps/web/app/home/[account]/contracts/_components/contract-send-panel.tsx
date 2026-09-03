'use client';

import { useState } from 'react';

import { Download, Link2, Loader2, Send, ShieldOff } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
import { Textarea } from '@kit/ui/textarea';

import { ConfirmSendEmailDialog } from '~/components/email/confirm-send-email-dialog';
import { formatPence } from '~/home/[account]/invoices/_lib/invoice-totals';

import {
  DEFAULT_CONTRACT_EMAIL_BODY,
  DEFAULT_CONTRACT_EMAIL_SIGNATURE,
  DEFAULT_CONTRACT_EMAIL_SUBJECT,
} from '../_lib/contract-smart-fields';
import { getErrorMessage } from '../_lib/error-message';
import {
  getContractPortalLink,
  revokeContractPortalLink,
  sendContract,
  sendContractReminder,
  setContractPortalLinkExpiry,
} from '../_lib/server/server-actions';

const EXPIRY_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
] as const;

const SMART_FIELDS = [
  '{{client.firstName}}',
  '{{client.fullName}}',
  '{{contract.title}}',
  '{{contract.total}}',
  '{{your.firstName}}',
];

export function ContractSendPanel({
  accountId,
  contractId,
  contractTitle,
  totalPence,
  currency,
  defaultEmail,
  initialSubject,
  initialBody,
  initialSignature,
  initialExpiresAt,
  initialRevokedAt,
  lastReminderAt,
  emailDeliveryStatus,
  initialSigningExpiresAt,
  onSent,
  onClose,
}: {
  accountId: string;
  contractId: string;
  contractTitle: string;
  totalPence: number;
  currency?: string;
  defaultEmail: string;
  initialSubject?: string | null;
  initialBody?: string | null;
  initialSignature?: string | null;
  initialExpiresAt?: string | null;
  initialRevokedAt?: string | null;
  lastReminderAt?: string | null;
  emailDeliveryStatus?: string | null;
  initialSigningExpiresAt?: string | null;
  onSent: () => void;
  onClose?: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState(
    initialSubject ?? DEFAULT_CONTRACT_EMAIL_SUBJECT,
  );
  const [body, setBody] = useState(initialBody ?? DEFAULT_CONTRACT_EMAIL_BODY);
  const [signature, setSignature] = useState(
    initialSignature ?? DEFAULT_CONTRACT_EMAIL_SIGNATURE,
  );
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt ?? null);
  const [revoked, setRevoked] = useState(Boolean(initialRevokedAt));
  const [expiryDays, setExpiryDays] = useState(90);
  const [signingExpiryDays, setSigningExpiryDays] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState<
    'send' | 'test' | 'link' | 'reminder' | 'resend' | 'expiry' | null
  >(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadPortalLink = async () => {
    if (portalUrl) return portalUrl;
    setLoading('link');
    try {
      const result = await getContractPortalLink({
        accountId,
        contractId,
        expiry_days: expiryDays,
      });
      const expiry =
        (result as { expires_at?: string | null } | null)?.expires_at ??
        (result as { data?: { expires_at?: string | null } } | null)?.data
          ?.expires_at ??
        null;
      setExpiresAt(expiry);
      setRevoked(false);
      const token =
        (result as { token?: string } | null)?.token ??
        (result as { data?: { token?: string } } | null)?.data?.token;
      if (!token) throw new Error('Could not generate link');
      const url = `${window.location.origin}/portal/contracts/${encodeURIComponent(token)}`;
      setPortalUrl(url);
      return url;
    } finally {
      setLoading(null);
    }
  };

  const handleSend = async (testOnly = false) => {
    if (!email.trim() && !testOnly) {
      toast.error('Recipient email is required');
      return;
    }
    setLoading(testOnly ? 'test' : 'send');
    try {
      await sendContract({
        accountId,
        contractId,
        sent_to_email: email.trim() || 'test@example.com',
        email_subject: subject,
        email_body: body,
        email_signature: signature,
        send_test_to_self: testOnly,
        expiry_days: expiryDays,
        signing_expiry_days: signingExpiryDays,
      });
      toast.success(testOnly ? 'Test email sent' : 'Contract sent');
      if (!testOnly) {
        setConfirmOpen(false);
        onSent();
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const insertField = (
    field: string,
    target: 'body' | 'subject' | 'signature',
  ) => {
    const setter =
      target === 'body'
        ? setBody
        : target === 'subject'
          ? setSubject
          : setSignature;
    setter(
      (prev) =>
        `${prev}${prev.endsWith(' ') || prev.length === 0 ? '' : ' '}${field}`,
    );
  };

  return (
    <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Send {contractTitle || 'contract'}
        </h2>
        {onClose ? (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="email">
        <TabsList>
          <TabsTrigger value="email">Send email</TabsTrigger>
          <TabsTrigger value="link">Shareable link</TabsTrigger>
          <TabsTrigger value="pdf">Export PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="mt-4 space-y-4">
          <div>
            <Label>To</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>
          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div>
            <Label>Signature</Label>
            <Textarea
              rows={3}
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {SMART_FIELDS.map((field) => (
              <Button
                key={field}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => insertField(field, 'body')}
              >
                {field}
              </Button>
            ))}
          </div>
          <div>
            <Label>Signing deadline</Label>
            <p className="text-muted-foreground mb-2 text-xs">
              Optional. Blocks signing after this date, even if the shareable
              link is still valid.
              {initialSigningExpiresAt
                ? ` Current deadline ${new Date(initialSigningExpiresAt).toLocaleDateString('en-GB')}.`
                : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={signingExpiryDays == null ? 'default' : 'outline'}
                className={
                  signingExpiryDays == null
                    ? 'bg-[var(--ozer-accent)] text-[#09111F]'
                    : undefined
                }
                onClick={() => setSigningExpiryDays(null)}
              >
                No deadline
              </Button>
              {EXPIRY_OPTIONS.map((option) => (
                <Button
                  key={`sign-${option.days}`}
                  type="button"
                  size="sm"
                  variant={signingExpiryDays === option.days ? 'default' : 'outline'}
                  className={
                    signingExpiryDays === option.days
                      ? 'bg-[var(--ozer-accent)] text-[#09111F]'
                      : undefined
                  }
                  onClick={() => setSigningExpiryDays(option.days)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-white/3 p-4 text-sm">
            <p className="font-medium">Preview summary</p>
            <p className="text-muted-foreground mt-2">
              {contractTitle} ·{' '}
              {formatPence(totalPence, currency?.toUpperCase() ?? 'GBP')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-[var(--ozer-accent)] text-[#09111F]"
              disabled={loading != null}
              onClick={() => {
                if (!email.trim()) {
                  toast.error('Recipient email is required');
                  return;
                }
                setConfirmOpen(true);
              }}
            >
              {loading === 'send' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send contract
            </Button>
            <Button
              variant="outline"
              disabled={loading != null}
              onClick={() => void handleSend(true)}
            >
              Send yourself a test
            </Button>
            <Button
              variant="outline"
              disabled={loading != null || revoked}
              onClick={async () => {
                if (!email.trim()) {
                  toast.error('Recipient email is required');
                  return;
                }
                setLoading(
                  emailDeliveryStatus === 'failed' ? 'resend' : 'reminder',
                );
                try {
                  await sendContractReminder({
                    accountId,
                    contractId,
                    sent_to_email: email.trim(),
                    expiry_days: expiryDays,
                    kind:
                      emailDeliveryStatus === 'failed' ? 'resend' : 'reminder',
                  });
                  toast.success(
                    emailDeliveryStatus === 'failed'
                      ? 'Contract resent'
                      : 'Reminder sent',
                  );
                  onSent();
                } catch (error) {
                  toast.error(getErrorMessage(error));
                } finally {
                  setLoading(null);
                }
              }}
            >
              {loading === 'resend' || loading === 'reminder' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {emailDeliveryStatus === 'failed'
                ? 'Resend email'
                : 'Send reminder'}
            </Button>
          </div>
          {lastReminderAt ? (
            <p className="text-muted-foreground text-xs">
              Last reminder{' '}
              {new Date(lastReminderAt).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="link" className="mt-4 space-y-4">
          <p className="text-muted-foreground text-sm">
            Share this link with your client to review and sign the agreement.
          </p>
          <Button
            variant="outline"
            disabled={loading === 'link'}
            onClick={async () => {
              const url = await loadPortalLink();
              await navigator.clipboard.writeText(url);
              toast.success('Link copied');
            }}
          >
            <Link2 className="mr-2 h-4 w-4" />
            Copy shareable link
          </Button>
          {portalUrl ? <Input readOnly value={portalUrl} /> : null}
          <p className="text-muted-foreground text-sm">
            {revoked
              ? 'This link has been revoked.'
              : expiresAt
                ? `Expires ${new Date(expiresAt).toLocaleDateString('en-GB')}`
                : 'No expiry set'}
          </p>
          {portalUrl && !revoked ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await revokeContractPortalLink({ accountId, contractId });
                  setRevoked(true);
                  toast.success('Shareable link revoked');
                } catch (error) {
                  toast.error(getErrorMessage(error));
                }
              }}
            >
              <ShieldOff className="mr-2 h-4 w-4" /> Revoke access
            </Button>
          ) : null}
          <div className="space-y-2">
            <Label>Link expiry</Label>
            <div className="flex flex-wrap gap-2">
              {EXPIRY_OPTIONS.map((option) => (
                <Button
                  key={option.days}
                  type="button"
                  size="sm"
                  variant={expiryDays === option.days ? 'default' : 'outline'}
                  className={
                    expiryDays === option.days
                      ? 'bg-[var(--ozer-accent)] text-[#09111F]'
                      : undefined
                  }
                  onClick={() => setExpiryDays(option.days)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {portalUrl && !revoked ? (
              <Button
                variant="outline"
                size="sm"
                disabled={loading != null}
                onClick={async () => {
                  setLoading('expiry');
                  try {
                    const result = await setContractPortalLinkExpiry({
                      accountId,
                      contractId,
                      expiry_days: expiryDays,
                    });
                    const next =
                      (result as { expires_at?: string | null } | null)
                        ?.expires_at ?? null;
                    setExpiresAt(next);
                    toast.success('Link expiry updated');
                  } catch (error) {
                    toast.error(getErrorMessage(error));
                  } finally {
                    setLoading(null);
                  }
                }}
              >
                {loading === 'expiry' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Update expiry
              </Button>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="pdf" className="mt-4">
          <Button asChild variant="outline">
            <a href={`/api/contracts/pdf?contractId=${contractId}`} download>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </a>
          </Button>
        </TabsContent>
      </Tabs>

      <ConfirmSendEmailDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Send this contract?"
        documentLabel={contractTitle}
        recipients={email.trim() ? [email.trim()] : []}
        subject={subject}
        confirmLabel="Send email"
        pending={loading === 'send'}
        onConfirm={() => void handleSend(false)}
      />
    </div>
  );
}
