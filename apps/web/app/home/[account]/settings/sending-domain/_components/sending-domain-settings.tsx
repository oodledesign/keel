'use client';

import { type ChangeEvent, useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Check, Copy, Loader2 } from 'lucide-react';

import { Alert, AlertDescription } from '@kit/ui/alert';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';
import {
  DEFAULT_SENDING_LOCAL_PART,
  DEFAULT_SENDING_LOCAL_PARTS,
  DEFAULT_SENDING_SUBDOMAIN,
  DEFAULT_SENDING_SUBDOMAIN_SUGGESTIONS,
  type SendingDomainRecord,
  formatSendingFromAddress,
  normalizeSendingDomain,
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

function statusBadgeClass(status: SendingDomainRecord['verification_status']) {
  if (status === 'verified') {
    return 'border-[color:var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]';
  }
  if (status === 'failed') {
    return 'border-destructive/30 bg-destructive/10 text-destructive';
  }
  return 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]';
}

function chipClass(active: boolean) {
  return cn(
    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
    active
      ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
      : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
  );
}

function SendingLocalPartField({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Input
        id={id}
        data-test={`${id}-input`}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
        placeholder="mail"
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
      />
      <div data-test={id} className="flex flex-wrap gap-1.5">
        {DEFAULT_SENDING_LOCAL_PARTS.map((part) => (
          <button
            key={part}
            type="button"
            data-test={`sending-local-part-${part}`}
            className={chipClass(value.trim().toLowerCase() === part)}
            disabled={disabled}
            onClick={() => onChange(part)}
          >
            {part}
          </button>
        ))}
      </div>
    </div>
  );
}

function previewApex(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return 'your-domain.co.uk';
  }

  try {
    return normalizeSendingDomain(trimmed);
  } catch {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, '');
  }
}

function previewFromAddress(input: {
  apex: string;
  useApex: boolean;
  subdomain: string;
  localPart: string;
}) {
  const domain = previewApex(input.apex);
  const sendingSubdomain = input.useApex
    ? null
    : input.subdomain.trim().toLowerCase() || DEFAULT_SENDING_SUBDOMAIN;

  return formatSendingFromAddress({
    localPart:
      input.localPart.trim().toLowerCase() || DEFAULT_SENDING_LOCAL_PART,
    domain,
    sendingSubdomain,
  });
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
  const [useApex, setUseApex] = useState(false);
  const [subdomainInput, setSubdomainInput] = useState(
    DEFAULT_SENDING_SUBDOMAIN,
  );
  const [localPart, setLocalPart] = useState(
    initialDomain?.default_local_part ?? DEFAULT_SENDING_LOCAL_PART,
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
        <h1 className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]">
          Sending domain
        </h1>
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Send circulation and campaign email from your own domain, for example{' '}
          <span className="font-medium text-[var(--workspace-shell-text)]">
            mail@mail.your-domain.co.uk
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
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setDomainInput(event.target.value)
              }
              placeholder="your-domain.co.uk"
              disabled={!canEdit || pending}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sending-subdomain">Sending subdomain</Label>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Type any single-label subdomain, for example{' '}
              <span className="font-medium">go</span> or{' '}
              <span className="font-medium">agency</span>. Chips are shortcuts.
              Default is <span className="font-medium">mail</span>. Choose Apex
              to send from the domain itself.
            </p>
            <Input
              id="sending-subdomain"
              data-test="sending-subdomain-input"
              value={useApex ? '' : subdomainInput}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setUseApex(false);
                setSubdomainInput(event.target.value);
              }}
              placeholder={useApex ? 'Apex — no subdomain' : 'mail'}
              disabled={!canEdit || pending || useApex}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_SENDING_SUBDOMAIN_SUGGESTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  data-test={`sending-subdomain-${label}`}
                  className={chipClass(
                    !useApex && subdomainInput.trim().toLowerCase() === label,
                  )}
                  disabled={!canEdit || pending}
                  onClick={() => {
                    setUseApex(false);
                    setSubdomainInput(label);
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                data-test="sending-subdomain-apex"
                className={chipClass(useApex)}
                disabled={!canEdit || pending}
                onClick={() => setUseApex(true)}
              >
                Apex
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sending-local-part">Default From address</Label>
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Type the left-hand side of the address, for example{' '}
              <span className="font-medium">accounts</span>,{' '}
              <span className="font-medium">info</span>, or{' '}
              <span className="font-medium">no-reply</span>. Mail will come from{' '}
              {accountName} once the domain is verified.
            </p>
            <SendingLocalPartField
              id="sending-local-part"
              value={localPart}
              disabled={!canEdit || pending}
              onChange={setLocalPart}
            />
            <p
              data-test="sending-from-preview"
              className="text-sm font-medium text-[var(--workspace-shell-text)]"
            >
              {previewFromAddress({
                apex: domainInput,
                useApex,
                subdomain: subdomainInput,
                localPart,
              })}
            </p>
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
                    sendingSubdomain: useApex
                      ? null
                      : subdomainInput.trim() || DEFAULT_SENDING_SUBDOMAIN,
                    localPart: localPart.trim() || DEFAULT_SENDING_LOCAL_PART,
                  });
                  setDomainInput('');
                  setUseApex(false);
                  setSubdomainInput(DEFAULT_SENDING_SUBDOMAIN);
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
                localPart: localPart.trim() || DEFAULT_SENDING_LOCAL_PART,
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
              setLocalPart(DEFAULT_SENDING_LOCAL_PART);
              setUseApex(false);
              setSubdomainInput(DEFAULT_SENDING_SUBDOMAIN);
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
  const fromAddress = formatSendingFromAddress({
    localPart: domain.default_local_part,
    domain: domain.domain,
    sendingSubdomain: domain.sending_subdomain,
  });
  const sendingHost = domain.sending_host || domain.domain;

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              {sendingHost}
            </p>
            {sendingHost !== domain.domain ? (
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Apex {domain.domain}
              </p>
            ) : null}
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              The sending host is locked after you add the domain. Changing it
              needs a new mail identity — remove this domain and add it again if
              you need a different subdomain.
            </p>
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              {domain.verification_status === 'verified'
                ? `${accountName} <${fromAddress}>`
                : 'Circulation and campaigns will keep using the existing Ozer sender until this domain is verified.'}
            </p>
          </div>
          <Badge
            variant={
              domain.verification_status === 'verified'
                ? 'success'
                : domain.verification_status === 'failed'
                  ? 'destructive'
                  : 'warning'
            }
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
                <th className="pr-3 pb-2 font-medium">Type</th>
                <th className="pr-3 pb-2 font-medium">Host</th>
                <th className="pr-3 pb-2 font-medium">Value</th>
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
                    <td className="py-3 pr-3 font-mono text-xs break-all">
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
            Type any From name, for example{' '}
            <span className="font-medium">accounts</span> or{' '}
            <span className="font-medium">no-reply</span>. Recipients see{' '}
            {accountName} as the sender name. The sending host stays{' '}
            <span className="font-medium">{sendingHost}</span>.
          </p>
        </div>
        <SendingLocalPartField
          id="connected-local-part"
          value={localPart}
          disabled={!canEdit || pending}
          onChange={onLocalPartChange}
        />
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          {formatSendingFromAddress({
            localPart:
              localPart.trim().toLowerCase() || domain.default_local_part,
            domain: domain.domain,
            sendingSubdomain: domain.sending_subdomain,
          })}
        </p>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            data-test="save-sending-local-part"
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
