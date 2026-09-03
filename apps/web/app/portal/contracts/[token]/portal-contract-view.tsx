'use client';

import { useState } from 'react';

import { Download, Loader2, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { DocumentHtmlPreview } from '~/components/document-rich-text';
import {
  SignatureCapture,
  type SignatureCaptureResult,
  SignatureDisplay,
} from '~/components/signature-capture';
import { getErrorMessage } from '~/home/[account]/contracts/_lib/error-message';
import {
  declineContractRecipientByTokenAction,
  signContractRecipientByTokenAction,
} from '~/home/[account]/contracts/_lib/server/server-actions';
import { formatPence } from '~/home/[account]/invoices/_lib/invoice-totals';

type PartyType = 'individual' | 'company';

type PortalSigner = {
  id: string;
  signing_order: number;
  role: string;
  name: string | null;
  email: string | null;
  company: string | null;
  party_type: PartyType | null;
  signature_type: string | null;
  signature_data: string | null;
  signed_at: string | null;
};

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
  version_id?: string | null;
  version_number?: number | null;
  content_hash?: string | null;
  signing_expires_at?: string | null;
  signing_expired?: boolean;
  signers?: PortalSigner[];
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
    <div className="inline-flex rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/60 p-1">
      {(['individual', 'company'] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
            value === option
              ? 'bg-[var(--ozer-accent)] text-[#09111F]'
              : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
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
  const signers = data.signers ?? [];
  const nextSigner =
    signers.find((signer) => !signer.signed_at && signer.role !== 'author') ??
    signers.find((signer) => !signer.signed_at) ??
    null;
  const waitingOnAuthor = nextSigner?.role === 'author';
  const [recipientType, setRecipientType] = useState<PartyType>(
    nextSigner?.party_type ?? data.recipient_type ?? 'individual',
  );
  const [recipientName, setRecipientName] = useState(
    nextSigner?.name ??
      data.recipient_name ??
      data.client?.display_name ??
      '',
  );
  const [recipientCompany, setRecipientCompany] = useState(
    nextSigner?.company ?? data.recipient_company ?? data.client?.company_name ?? '',
  );
  const [signing, setSigning] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [signed, setSigned] = useState(data.status === 'signed');
  const [partyDone, setPartyDone] = useState(false);
  const [declined, setDeclined] = useState(data.status === 'cancelled');

  const canSign =
    !signed &&
    !partyDone &&
    !declined &&
    !data.signing_expired &&
    !waitingOnAuthor &&
    Boolean(data.author_signed_at) &&
    ['sent', 'ready_to_sign'].includes(data.status) &&
    (signers.length === 0 ? !data.recipient_signed_at : Boolean(nextSigner));

  const pdfUrl = `/api/contracts/pdf?token=${encodeURIComponent(token)}`;

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await declineContractRecipientByTokenAction({
        token,
        reason: declineReason.trim() || null,
      });
      toast.success('Agreement declined');
      setDeclined(true);
      setShowDecline(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeclining(false);
    }
  };

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
      const result = await signContractRecipientByTokenAction({
        token,
        recipient_type: recipientType,
        recipient_name: recipientName.trim(),
        recipient_company:
          recipientType === 'company' ? recipientCompany.trim() || null : null,
        recipient_signature_type: signature.signature_type,
        recipient_signature_data: signature.signature_data,
        version_id: data.version_id ?? undefined,
        content_hash: data.content_hash ?? undefined,
        signer_id: nextSigner?.id,
      });
      const fullySigned =
        (result as { status?: string } | null)?.status === 'signed';
      toast.success(
        fullySigned
          ? 'Agreement signed successfully'
          : 'Your signature has been recorded',
      );
      if (fullySigned) setSigned(true);
      else setPartyDone(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/80 p-6 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {data.account?.name ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              {data.account.name}
            </p>
          ) : null}
          <h1 className="text-2xl font-bold text-[var(--workspace-shell-text)]">
            {data.title?.trim() || 'Agreement'}
          </h1>
          {typeof data.version_number === 'number' ? (
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              Version {data.version_number}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            {signed
              ? 'Fully executed agreement'
              : partyDone
                ? 'Your signature has been recorded. Waiting for remaining parties.'
                : data.signing_expired
                  ? 'Signing deadline has passed'
                  : canSign
                    ? nextSigner?.name
                      ? `Please review and sign as ${nextSigner.name}`
                      : 'Please review and sign below'
                    : waitingOnAuthor
                      ? 'Awaiting author signature'
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

      <div className="mt-6 overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]">
        <DocumentHtmlPreview html={data.content_html ?? ''} />
      </div>

      {(data.payment_plan?.length ?? 0) > 0 ? (
        <div className="mt-6 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/50 p-4">
          <h2 className="text-sm font-medium text-[var(--workspace-shell-text-muted)]">
            Payment plan
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-[var(--workspace-shell-text-muted)]">
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
            <p className="mt-2 text-sm font-medium text-[var(--workspace-shell-text)]">
              Total{' '}
              {formatPence(
                data.total_pence,
                data.currency?.toUpperCase() ?? 'GBP',
              )}
            </p>
          ) : null}
        </div>
      ) : null}

      {signers.length > 2 ? (
        <ol className="mt-6 space-y-1 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/40 p-4 text-sm">
          <li className="mb-2 font-medium text-[var(--workspace-shell-text)]">
            Signing order
          </li>
          {signers.map((signer) => (
            <li
              key={signer.id}
              className="text-[var(--workspace-shell-text-muted)]"
            >
              {signer.signing_order}. {signer.name || (signer.role === 'author' ? 'Author' : 'Signer')}
              {signer.signed_at ? ' — signed' : nextSigner?.id === signer.id ? ' — your turn' : ' — waiting'}
            </li>
          ))}
        </ol>
      ) : null}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/40 p-4">
          <h3 className="text-sm font-medium text-[var(--workspace-shell-text-muted)]">
            Author
          </h3>
          <SignatureDisplay
            type={data.author_signature_type}
            data={data.author_signature_data}
            name={data.author_name}
            signedAt={data.author_signed_at}
          />
        </div>
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/40 p-4">
          <h3 className="text-sm font-medium text-[var(--workspace-shell-text-muted)]">
            {nextSigner && nextSigner.signing_order > 2
              ? nextSigner.name || 'Additional signer'
              : 'Recipient'}
          </h3>
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
                <Label className="mb-2 block text-[var(--workspace-shell-text-muted)]">
                  Signing as
                </Label>
                <PartyTypeToggle
                  value={recipientType}
                  onChange={setRecipientType}
                />
              </div>
              <div>
                <Label className="text-[var(--workspace-shell-text-muted)]">
                  Your name
                </Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              {recipientType === 'company' ? (
                <div>
                  <Label className="text-[var(--workspace-shell-text-muted)]">
                    Company
                  </Label>
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
            <p className="mt-3 text-sm text-[var(--workspace-shell-text-muted)]">
              Not available for signing yet
            </p>
          )}
        </div>
      </div>

      {canSign && !showDecline ? (
        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            size="sm"
            disabled={declining}
            onClick={() => setShowDecline(true)}
          >
            <X className="mr-2 h-4 w-4" /> Decline agreement
          </Button>
        </div>
      ) : null}
      {canSign && showDecline ? (
        <div className="mt-6 space-y-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <Label>Reason (optional)</Label>
          <Textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="Let us know why"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDecline(false)}
              disabled={declining}
            >
              Keep agreement
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDecline()}
              disabled={declining}
            >
              {declining ? 'Declining…' : 'Confirm decline'}
            </Button>
          </div>
        </div>
      ) : null}

      {declined ? (
        <div className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-center text-red-200">
          You declined this agreement.
        </div>
      ) : null}

      {signed || partyDone ? (
        <div className="mt-6 rounded-lg border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-4 py-3 text-center text-[#97D9AA]">
          {signing ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          ) : signed ? (
            'Thank you — your signature has been recorded.'
          ) : (
            'Your signature has been recorded. Remaining parties still need to sign.'
          )}
        </div>
      ) : null}
    </div>
  );
}
