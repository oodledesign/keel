'use client';

import { useState } from 'react';

import { Check, Copy } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import {
  dnsRecordPurposeLabel,
  type PublicSendingDomainInstructions,
  type SendingDnsRecord,
} from '~/lib/sending-domains';

function statusLabel(
  status: PublicSendingDomainInstructions['verificationStatus'],
) {
  if (status === 'verified') return 'Verified';
  if (status === 'failed') return 'Needs attention';
  return 'Waiting for DNS';
}

function CopyableCell({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-start gap-1">
      <span className="font-mono text-xs break-all text-[var(--ozer-plum-900,#2B1B33)]">
        {value}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 w-7 shrink-0 p-0 text-neutral-500 hover:text-[var(--ozer-plum-900,#2B1B33)]"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error('Could not copy. Select the value and copy it manually.');
          }
        }}
      >
        {copied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

function DnsTable({ records }: { records: SendingDnsRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-neutral-500">
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Host</th>
            <th className="px-4 py-3 font-medium">Value</th>
            <th className="px-4 py-3 font-medium">Purpose</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => (
            <tr
              key={`${record.type}-${record.host}-${index}`}
              className="border-t border-black/5 align-top"
            >
              <td className="px-4 py-3 font-medium text-[var(--ozer-plum-900,#2B1B33)]">
                {record.type}
              </td>
              <td className="px-4 py-3">
                <CopyableCell value={record.host} label={`${record.type} host`} />
              </td>
              <td className="px-4 py-3">
                <CopyableCell
                  value={record.value}
                  label={`${record.type} value`}
                />
              </td>
              <td className="px-4 py-3 text-xs text-neutral-600">
                {dnsRecordPurposeLabel(record.purpose)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PublicSendingDomainInstructionsView({
  instructions,
}: {
  instructions: PublicSendingDomainInstructions;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="space-y-3 rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
              Ozer · DNS setup
            </p>
            <h1 className="font-heading text-2xl font-bold text-[var(--ozer-plum-900,#2B1B33)]">
              Sending domain for {instructions.accountName}
            </h1>
            <p className="text-sm text-neutral-600">
              Apex{' '}
              <span className="font-medium text-[var(--ozer-plum-900,#2B1B33)]">
                {instructions.domain}
              </span>
              {' · '}
              Sending host{' '}
              <span className="font-medium text-[var(--ozer-plum-900,#2B1B33)]">
                {instructions.sendingHost}
              </span>
            </p>
          </div>
          <Badge
            variant={
              instructions.verificationStatus === 'verified'
                ? 'success'
                : instructions.verificationStatus === 'failed'
                  ? 'destructive'
                  : 'warning'
            }
          >
            {statusLabel(instructions.verificationStatus)}
          </Badge>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-base font-semibold text-[var(--ozer-plum-900,#2B1B33)]">
          Steps
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-700">
          <li>
            Sign in to your DNS host (Cloudflare, 123-reg, GoDaddy, Route 53,
            etc.) for{' '}
            <span className="font-medium">{instructions.domain}</span>.
          </li>
          <li>
            Add each record below exactly as shown. Host values are usually
            relative to the apex — if your host expects a full hostname, use the
            Host value plus <span className="font-medium">.{instructions.domain}</span>.
          </li>
          <li>
            Save the records and wait for DNS to propagate (often minutes, up to
            a few hours).
          </li>
          <li>
            Tell the workspace owner to open{' '}
            <span className="font-medium">Sending domain</span> settings in Ozer
            and hit <span className="font-medium">Check status</span> (or{' '}
            <span className="font-medium">I&apos;ve added the records</span>).
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <div className="space-y-1 px-1">
          <h2 className="text-base font-semibold text-[var(--ozer-plum-900,#2B1B33)]">
            DNS records
          </h2>
          <p className="text-sm text-neutral-600">
            Copy Host and Value into your DNS host. These records enable Ozer
            DKIM signing and bounce handling for{' '}
            <span className="font-medium">{instructions.sendingHost}</span>.
          </p>
        </div>
        <DnsTable records={instructions.dnsRecords} />
      </section>

      <p className="px-1 text-center text-xs text-neutral-500">
        This page is read-only and does not require an Ozer login. Do not share
        internal mail-provider identifiers — these DNS values are all that is
        needed.
      </p>
    </div>
  );
}
