'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Check, Copy, Loader2 } from 'lucide-react';

import { Alert, AlertDescription } from '@kit/ui/alert';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import {
  DEFAULT_SENDING_LOCAL_PARTS,
  type SendingDomainRecord,
} from '~/lib/sending-domains';
import { workspaceBtnPrimary } from '~/lib/workspace-ui';

import {
  addSendingDomainAction,
  refreshSendingDomainAction,
  removeSendingDomainAction,
  sendSendingDomainTestAction,
  updateSendingLocalPartAction,
} from '../../_lib/server/sending-domain-actions';

function statusLabel(status: SendingDomainRecord['verification_status']) {
  if (status === 'verified') return 'Verified';
  if (status === 'failed') return 'Needs attention';
  return 'Waiting for DNS';
}

function statusBadgeClass(
  status: SendingDomainRecord['verification_status'],
) {
  if (status === 'verified') {
    return 'border-[color:var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]';
  }
  if (status === 'failed') {
    return 'border-destructive/30 bg-destructive/10 text-destructive';
  }
  return 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]';
}

export function SendingDomainSettings({
  accountId,
  accountName,
  canEdit,
  initialDomain,
}: {
  accountId: string;
  accountName: string;
  canEdit: boolean;
  initialDomain: SendingDomainRecord | null;
}) {
  const router = useRouter();
  const [domainInput, setDomainInput] = useState('');
  const [localPart, setLocalPart] = useState(
    initialDomain?.default_local_part ?? 'listings',
  );
  const [pending, startTransition] = useTransition();
  const [copiedHost, setCopiedHost] = useState<string | null>(null);

  useEffect(() => {
    if (!initialDomain || initialDomain.verification_status !== 'pending') {
      return;
    }

    const timer = window.setInterval(() => {
      startTransition(async () => {
        try {
          await refreshSendingDomainAction({ accountId });
          router.refresh();
        } catch {
          // Keep polling; the Check status button surfaces errors.
        }
      });
    }, 15000);

    return () => window.clearInterval(timer);
  }, [accountId, initialDomain, router]);

  const run = (task: () => Promise<void>, success?: string) => {
    startTransition(async () => {
      try {
        await task();
        if (success) {
          toast.success(success);
        }
        router.refresh();
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const copyValue = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedHost(key);
      window.setTimeout(() => setCopiedHost(null), 1500);
    } catch {
      toast.error('Could not copy. Select the value and copy it manually.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl text-[var(--workspace-shell-text)]">
          Sending domain
        </h1>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Send circulation and campaign email from your own domain, for example{' '}
          <span className="font-medium text-[var(--workspace-shell-text)]">
            listings@bracketts.co.uk
          </span>
          . Invites and sign-in emails still come from Ozer.
        </p>
      </div>

      {!canEdit ? (
        <p className="text-muted-foreground rounded-xl border border-[color:var(--workspace-shell-border)] bg-black/10 px-4 py-3 text-sm">
          Only workspace owners and admins can change the sending domain.
        </p>
      ) : null}

      {!initialDomain ? (
        <div className="grid gap-5 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6">
          <div className="space-y-2">
            <Label htmlFor="sending-domain">Domain</Label>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Enter the domain only — not a full email address.
            </p>
            <Input
              id="sending-domain"
              data-test="sending-domain-input"
              value={domainInput}
              onChange={(event) => setDomainInput(event.target.value)}
              placeholder="bracketts.co.uk"
              disabled={!canEdit || pending}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sending-local-part">Default From address</Label>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Mail will come from {accountName} using this address once the
              domain is verified.
            </p>
            <select
              id="sending-local-part"
              data-test="sending-local-part"
              className="border-input bg-background h-10 w-full max-w-xs rounded-md border px-3 text-sm"
              value={localPart}
              onChange={(event) => setLocalPart(event.target.value)}
              disabled={!canEdit || pending}
            >
              {DEFAULT_SENDING_LOCAL_PARTS.map((part) => (
                <option key={part} value={part}>
                  {part}@{domainInput.trim() || 'your-domain.co.uk'}
                </option>
              ))}
            </select>
          </div>

          {canEdit ? (
            <Button
              type="button"
              data-test="add-sending-domain"
              className={workspaceBtnPrimary}
              disabled={pending || !domainInput.trim()}
              onClick={() =>
                run(async () => {
                  await addSendingDomainAction({
                    accountId,
                    domain: domainInput,
                    localPart: localPart as (typeof DEFAULT_SENDING_LOCAL_PARTS)[number],
                  });
                  setDomainInput('');
                }, 'Domain added. Add the DNS records at your host.')
              }
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding domain...
                </>
              ) : (
                'Add domain'
              )}
            </Button>
          ) : null}
        </div>
      ) : (
        <ConnectedDomain
          accountId={accountId}
          accountName={accountName}
          canEdit={canEdit}
          domain={initialDomain}
          localPart={localPart}
          pending={pending}
          copiedHost={copiedHost}
          onLocalPartChange={setLocalPart}
          onCopy={copyValue}
          onRefresh={() =>
            run(async () => {
              await refreshSendingDomainAction({ accountId });
            }, 'Status updated')
          }
          onSaveLocalPart={() =>
            run(async () => {
              await updateSendingLocalPartAction({
                accountId,
                localPart: localPart as (typeof DEFAULT_SENDING_LOCAL_PARTS)[number],
              });
            }, 'From address saved')
          }
          onTest={() =>
            run(async () => {
              await sendSendingDomainTestAction({ accountId });
            }, 'Test email sent to your signed-in address')
          }
          onRemove={() =>
            run(async () => {
              await removeSendingDomainAction({ accountId });
              setLocalPart('listings');
            }, 'Sending domain removed')
          }
        />
      )}
    </div>
  );
}

function ConnectedDomain({
  accountId: _accountId,
  accountName,
  canEdit,
  domain,
  localPart,
  pending,
  copiedHost,
  onLocalPartChange,
  onCopy,
  onRefresh,
  onSaveLocalPart,
  onTest,
  onRemove,
}: {
  accountId: string;
  accountName: string;
  canEdit: boolean;
  domain: SendingDomainRecord;
  localPart: string;
  pending: boolean;
  copiedHost: string | null;
  onLocalPartChange: (value: string) => void;
  onCopy: (value: string, key: string) => void;
  onRefresh: () => void;
  onSaveLocalPart: () => void;
  onTest: () => void;
  onRemove: () => void;
}) {
  const fromAddress = `${domain.default_local_part}@${domain.domain}`;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              {domain.domain}
            </p>
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              {domain.verification_status === 'verified'
                ? `${accountName} <${fromAddress}>`
                : 'Circulation and campaigns will keep using the existing Ozer sender until this domain is verified.'}
            </p>
          </div>
          <Badge
            variant="outline"
            className={statusBadgeClass(domain.verification_status)}
          >
            {statusLabel(domain.verification_status)}
          </Badge>
        </div>

        {domain.verification_status === 'failed' ? (
          <Alert variant="destructive">
            <AlertDescription>
              We could not verify the DNS records yet. Check the host and value
              at your DNS host, wait for them to propagate, then check again.
            </AlertDescription>
          </Alert>
        ) : null}

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              data-test="refresh-sending-domain"
              disabled={pending}
              onClick={onRefresh}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {domain.verification_status === 'pending'
                ? "I've added the records"
                : 'Check status'}
            </Button>
            {domain.verification_status === 'verified' ? (
              <Button
                type="button"
                variant="outline"
                data-test="test-sending-domain"
                disabled={pending}
                onClick={onTest}
              >
                Send test email
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              data-test="remove-sending-domain"
              disabled={pending}
              onClick={onRemove}
            >
              Remove domain
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6">
        <div className="space-y-1">
          <h2 className="text-base font-medium text-[var(--workspace-shell-text)]">
            DNS records
          </h2>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Add these records at your DNS host (Cloudflare, 123-reg, etc.).
            Propagation can take a few hours.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="text-[var(--workspace-shell-text-muted)]">
                <th className="pb-2 pr-3 font-medium">Type</th>
                <th className="pb-2 pr-3 font-medium">Host</th>
                <th className="pb-2 pr-3 font-medium">Value</th>
                <th className="pb-2 font-medium">
                  <span className="sr-only">Copy</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {domain.dns_records.map((record, index) => {
                const key = `${record.type}-${record.host}-${index}`;
                return (
                  <tr
                    key={key}
                    className="border-t border-[color:var(--workspace-shell-border)] align-top"
                  >
                    <td className="py-3 pr-3 font-medium">{record.type}</td>
                    <td className="py-3 pr-3 font-mono text-xs">
                      {record.host}
                    </td>
                    <td className="py-3 pr-3 break-all font-mono text-xs">
                      {record.value}
                    </td>
                    <td className="py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Copy ${record.type} value`}
                        onClick={() => onCopy(record.value, key)}
                      >
                        {copiedHost === key ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6">
        <div className="space-y-1">
          <Label htmlFor="connected-local-part">Default From address</Label>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Recipients see {accountName} as the sender name.
          </p>
        </div>
        <select
          id="connected-local-part"
          className="border-input bg-background h-10 w-full max-w-xs rounded-md border px-3 text-sm"
          value={localPart}
          onChange={(event) => onLocalPartChange(event.target.value)}
          disabled={!canEdit || pending}
        >
          {DEFAULT_SENDING_LOCAL_PARTS.map((part) => (
            <option key={part} value={part}>
              {part}@{domain.domain}
            </option>
          ))}
        </select>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending || localPart === domain.default_local_part}
            onClick={onSaveLocalPart}
          >
            Save From address
          </Button>
        ) : null}
      </div>
    </div>
  );
}
