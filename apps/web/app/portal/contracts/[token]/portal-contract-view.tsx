'use client';

import { useState } from 'react';

import { Download, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { DocumentHtmlPreview } from '~/components/document-rich-text';
import {
  SignatureCapture,
  SignatureDisplay,
  type SignatureCaptureResult,
} from '~/components/signature-capture';
import { formatPence } from '~/home/[account]/invoices/_lib/invoice-totals';

import { getErrorMessage } from '~/home/[account]/contracts/_lib/error-message';
import { signContractRecipientByTokenAction } from '~/home/[account]/contracts/_lib/server/server-actions';

type PartyType = 'individual' | 'company';

type ContractPayload = {
  id: string;
  title: string | null;
  content_html: string | null;
  status: string;
  total_pence: number;
  currency: string;
  payment_plan: Array<{ label: string; percent: number }>;
  author_name: string | null;
  author_company: string | null;
  author_signature_type: string | null;
  author_signature_data: string | null;
  author_signed_at: string | null;
  recipient_type: PartyType | null;
  recipient_name: string | null;
  recipient_company: string | null;
  recipient_email: string | null;
  recipient_signature_type: string | null;
  recipient_signature_data: string | null;
  recipient_signed_at: string | null;
  account: { name?: string | null } | null;
  client: {
    display_name?: string | null;
    company_name?: string | null;
    email?: string | null;
  } | null;
};

function PartyTypeToggle({
  value,
  onChange,
  disabled,
}: {
  value: PartyType;
  onChange: (value: PartyType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-600 bg-zinc-800/60 p-1">
      {(['individual', 'company'] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
            value === option
              ? 'bg-[var(--keel-teal)] text-[#09111F]'
              : 'text-zinc-300 hover:text-white'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function PortalContractView({
  contract,
  token,
}: {
  contract: Record<string, unknown>;
  token: string;
}) {
  const data = contract as unknown as ContractPayload;
  const [recipientType, setRecipientType] = useState<PartyType>(data.recipient_type ?? 'individual');
  const [recipientName, setRecipientName] = useState(
    data.recipient_name ?? data.client?.display_name ?? '',
  );
  const [recipientCompany, setRecipientCompany] = useState(
    data.recipient_company ?? data.client?.company_name ?? '',
  );
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(Boolean(data.recipient_signed_at) || data.status === 'signed');

  const canSign =
    !signed &&
    Boolean(data.author_signed_at) &&
    ['sent', 'ready_to_sign'].includes(data.status);

  const pdfUrl = `/api/contracts/pdf?token=${encodeURIComponent(token)}`;

  const handleSign = async (signature: SignatureCaptureResult) => {
    if (!recipientName.trim()) {
      toast.error('Your name is required');
      return;
    }
    if (recipientType === 'company' && !recipientCompany.trim()) {
      toast.error('Company name is required');
      return;
    }

    setSigning(true);
    try {
      await signContractRecipientByTokenAction({
        token,
        recipient_type: recipientType,
        recipient_name: recipientName.trim(),
        recipient_company: recipientType === 'company' ? recipientCompany.trim() || null : null,
        recipient_signature_type: signature.signature_type,
        recipient_signature_data: signature.signature_data,
      });
      toast.success('Agreement signed successfully');
      setSigned(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-6 shadow-lg sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {data.account?.name ? (
            <p className="text-sm text-zinc-400">{data.account.name}</p>
          ) : null}
          <h1 className="text-2xl font-bold text-white">{data.title?.trim() || 'Agreement'}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {signed
              ? 'Fully executed agreement'
              : canSign
                ? 'Please review and sign below'
                : 'Awaiting author signature'}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={pdfUrl}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </a>
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-700">
        <DocumentHtmlPreview html={data.content_html ?? ''} />
      </div>

      {(data.payment_plan?.length ?? 0) > 0 ? (
        <div className="mt-6 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          <h2 className="text-sm font-medium text-zinc-400">Payment plan</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            {data.payment_plan.map((row, index) => (
              <li key={index}>
                {row.label}: {row.percent}%
                {data.total_pence > 0
                  ? ` (${formatPence(Math.round((data.total_pence * row.percent) / 100), data.currency?.toUpperCase() ?? 'GBP')})`
                  : ''}
              </li>
            ))}
          </ul>
          {data.total_pence > 0 ? (
            <p className="mt-2 text-sm font-medium text-white">
              Total {formatPence(data.total_pence, data.currency?.toUpperCase() ?? 'GBP')}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
          <h3 className="text-sm font-medium text-zinc-400">Author</h3>
          <SignatureDisplay
            type={data.author_signature_type}
            data={data.author_signature_data}
            name={data.author_name}
            signedAt={data.author_signed_at}
          />
        </div>
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-4">
          <h3 className="text-sm font-medium text-zinc-400">Recipient</h3>
          {signed || data.recipient_signed_at ? (
            <SignatureDisplay
              type={data.recipient_signature_type}
              data={data.recipient_signature_data}
              name={data.recipient_name}
              signedAt={data.recipient_signed_at}
            />
          ) : canSign ? (
            <div className="mt-3 space-y-3">
              <div>
                <Label className="mb-2 block text-zinc-300">Signing as</Label>
                <PartyTypeToggle value={recipientType} onChange={setRecipientType} />
              </div>
              <div>
                <Label className="text-zinc-300">Your name</Label>
                <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
              </div>
              {recipientType === 'company' ? (
                <div>
                  <Label className="text-zinc-300">Company</Label>
                  <Input
                    value={recipientCompany}
                    onChange={(e) => setRecipientCompany(e.target.value)}
                  />
                </div>
              ) : null}
              <SignatureCapture
                defaultName={recipientName}
                loading={signing}
                onConfirm={(result) => void handleSign(result)}
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">Not available for signing yet</p>
          )}
        </div>
      </div>

      {signed ? (
        <div className="mt-6 rounded-lg border border-[var(--keel-teal)]/30 bg-[var(--keel-teal)]/10 px-4 py-3 text-center text-[#97D9AA]">
          {signing ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Thank you — your signature has been recorded.'}
        </div>
      ) : null}
    </div>
  );
}
