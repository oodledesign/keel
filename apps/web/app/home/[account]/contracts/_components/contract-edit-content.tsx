'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { ArrowLeft, Check, Loader2, PlusCircle, Save, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { toast } from '@kit/ui/sonner';

import {
  DocumentHtmlPreview,
  DocumentRichTextEditor,
} from '~/components/document-rich-text';
import {
  SignatureCapture,
  SignatureDisplay,
  type SignatureCaptureResult,
} from '~/components/signature-capture';
import pathsConfig from '~/config/paths.config';
import { formatPence } from '~/home/[account]/invoices/_lib/invoice-totals';

import type { PaymentPlanItem } from '../_lib/schema/contracts.schema';
import { getErrorMessage } from '../_lib/error-message';
import { signAuthor, updateContract } from '../_lib/server/server-actions';
import { ContractSendPanel } from './contract-send-panel';
import { ContractStatusBadge } from './contract-status-badge';

type PartyType = 'individual' | 'company';

type ClientInfo = {
  id: string;
  display_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
};

type ContractData = {
  id: string;
  account_id: string;
  client_id: string | null;
  title: string | null;
  content_html: string | null;
  status: string;
  total_pence: number;
  currency: string;
  payment_plan: PaymentPlanItem[];
  auto_send_on_approval: boolean;
  author_type: PartyType | null;
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
  email_subject: string | null;
  email_body: string | null;
  email_signature: string | null;
  client: ClientInfo | null;
};

const WIZARD_STEPS = [
  { key: 1, label: 'Your info' },
  { key: 2, label: 'Recipient' },
  { key: 3, label: 'Review & sign' },
] as const;

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
    <div className="inline-flex rounded-lg border border-white/10 bg-[var(--workspace-control-surface)]/60 p-1">
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

export function ContractEditContent({
  accountSlug,
  accountId,
  contract: initialContract,
  canEditContracts,
}: {
  accountSlug: string;
  accountId: string;
  contract: Record<string, unknown>;
  canEditContracts: boolean;
  canManageContractStatus: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contract = initialContract as unknown as ContractData;
  const contractsPath = pathsConfig.app.accountContracts.replace('[account]', accountSlug);

  const isDraft = contract.status === 'draft';
  const canEditBody = canEditContracts && isDraft;
  const authorSigned = Boolean(contract.author_signed_at);
  const recipientSigned = Boolean(contract.recipient_signed_at);
  const showSendPanel =
    authorSigned &&
    !recipientSigned &&
    ['ready_to_sign', 'sent'].includes(contract.status);

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState(contract.title ?? 'Agreement');
  const [contentHtml, setContentHtml] = useState(contract.content_html ?? '');
  const [totalPence, setTotalPence] = useState(String((contract.total_pence ?? 0) / 100));
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlanItem[]>(
    contract.payment_plan?.length ? contract.payment_plan : [],
  );
  const [autoSendOnApproval, setAutoSendOnApproval] = useState(
    contract.auto_send_on_approval ?? false,
  );

  const [authorType, setAuthorType] = useState<PartyType>(contract.author_type ?? 'individual');
  const [authorName, setAuthorName] = useState(contract.author_name ?? '');
  const [authorCompany, setAuthorCompany] = useState(contract.author_company ?? '');

  const [recipientType, setRecipientType] = useState<PartyType>(
    contract.recipient_type ?? 'individual',
  );
  const [recipientName, setRecipientName] = useState(
    contract.recipient_name ??
      contract.client?.display_name ??
      [contract.client?.first_name, contract.client?.last_name].filter(Boolean).join(' ') ??
      '',
  );
  const [recipientCompany, setRecipientCompany] = useState(
    contract.recipient_company ?? contract.client?.company_name ?? '',
  );
  const [recipientEmail, setRecipientEmail] = useState(
    contract.recipient_email ?? contract.client?.email ?? '',
  );

  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [sendPanelOpen, setSendPanelOpen] = useState(searchParams.get('send') === '1');

  useEffect(() => {
    if (searchParams.get('send') === '1') setSendPanelOpen(true);
  }, [searchParams]);

  const paymentPlanTotal = useMemo(
    () => paymentPlan.reduce((sum, row) => sum + (Number(row.percent) || 0), 0),
    [paymentPlan],
  );

  const buildUpdatePayload = useCallback(() => {
    const parsedTotal = Math.round(parseFloat(totalPence || '0') * 100);
    return {
      accountId,
      contractId: contract.id,
      title: title.trim() || 'Agreement',
      content_html: contentHtml,
      total_pence: Number.isFinite(parsedTotal) ? parsedTotal : 0,
      payment_plan: paymentPlan.filter((row) => row.label.trim()),
      auto_send_on_approval: autoSendOnApproval,
      author_type: authorType,
      author_name: authorName.trim() || null,
      author_company: authorType === 'company' ? authorCompany.trim() || null : null,
      recipient_type: recipientType,
      recipient_name: recipientName.trim() || null,
      recipient_company: recipientType === 'company' ? recipientCompany.trim() || null : null,
      recipient_email: recipientEmail.trim() || null,
    };
  }, [
    accountId,
    authorCompany,
    authorName,
    authorType,
    autoSendOnApproval,
    contentHtml,
    contract.id,
    paymentPlan,
    recipientCompany,
    recipientEmail,
    recipientName,
    recipientType,
    title,
    totalPence,
  ]);

  const handleSaveDraft = async () => {
    if (!canEditBody) return;
    setSaving(true);
    try {
      await updateContract(buildUpdatePayload());
      toast.success('Draft saved');
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const validateWizard = (step: 1 | 2 | 3) => {
    if (step === 1 && !authorName.trim()) {
      toast.error('Your name is required');
      return false;
    }
    if (step === 1 && authorType === 'company' && !authorCompany.trim()) {
      toast.error('Your company name is required');
      return false;
    }
    if (step === 2 && !recipientName.trim()) {
      toast.error('Recipient name is required');
      return false;
    }
    if (step === 2 && recipientType === 'company' && !recipientCompany.trim()) {
      toast.error('Recipient company is required');
      return false;
    }
    if (step === 2 && !recipientEmail.trim()) {
      toast.error('Recipient email is required');
      return false;
    }
    if (step === 3 && paymentPlan.length > 0 && paymentPlanTotal !== 100) {
      toast.error('Payment plan percentages must total 100%');
      return false;
    }
    return true;
  };

  const handleSignAuthor = async (signature: SignatureCaptureResult) => {
    if (!canEditContracts || authorSigned) return;
    if (!validateWizard(3)) return;

    setSigning(true);
    try {
      if (isDraft) {
        await updateContract(buildUpdatePayload());
      }
      await signAuthor({
        accountId,
        contractId: contract.id,
        author_type: authorType,
        author_name: authorName.trim(),
        author_company: authorType === 'company' ? authorCompany.trim() || null : null,
        author_signature_type: signature.signature_type,
        author_signature_data: signature.signature_data,
        send_after_sign: autoSendOnApproval,
        sent_to_email: autoSendOnApproval ? recipientEmail.trim() : undefined,
      });
      toast.success(
        autoSendOnApproval ? 'Signed and sent to recipient' : 'Contract signed — ready to send',
      );
      setSendPanelOpen(true);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSigning(false);
    }
  };

  const addPaymentRow = () => {
    setPaymentPlan((rows) => [...rows, { label: '', percent: 0 }]);
  };

  const updatePaymentRow = (index: number, patch: Partial<PaymentPlanItem>) => {
    setPaymentPlan((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const removePaymentRow = (index: number) => {
    setPaymentPlan((rows) => rows.filter((_, i) => i !== index));
  };

  const parsedTotalPence = Math.round(parseFloat(totalPence || '0') * 100) || 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={contractsPath}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Contracts
            </Link>
          </Button>
          <ContractStatusBadge
            status={contract.status}
            authorSignedAt={contract.author_signed_at}
            recipientSignedAt={contract.recipient_signed_at}
          />
        </div>
        <div className="flex gap-2">
          {canEditBody ? (
            <Button variant="outline" size="sm" disabled={saving} onClick={() => void handleSaveDraft()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save draft
            </Button>
          ) : null}
          {showSendPanel && !sendPanelOpen ? (
            <Button
              size="sm"
              className="bg-[var(--keel-teal)] text-[#09111F]"
              onClick={() => setSendPanelOpen(true)}
            >
              Send contract
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-[var(--workspace-shell-panel)] p-4 md:p-6">
            <div className="mb-4 space-y-3">
              <div>
                <Label>Agreement title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canEditBody}
                  placeholder="Services agreement"
                />
              </div>
              <div>
                <Label>Contract value (£)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={totalPence}
                  onChange={(e) => setTotalPence(e.target.value)}
                  disabled={!canEditBody}
                />
              </div>
            </div>

            <Label className="mb-2 block">Document</Label>
            <div className="overflow-hidden rounded-xl border border-white/10 shadow-inner">
              {canEditBody ? (
                <DocumentRichTextEditor
                  value={contentHtml}
                  onChange={setContentHtml}
                  minHeight={420}
                  placeholder="Write the agreement terms…"
                />
              ) : (
                <DocumentHtmlPreview html={contentHtml} className="min-h-[420px]" />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-[var(--workspace-shell-panel)] p-4 md:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-white">Payment plan</h3>
                <p className="text-sm text-zinc-400">Optional instalments after signing</p>
              </div>
              {canEditBody ? (
                <Button type="button" size="sm" variant="outline" onClick={addPaymentRow}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add row
                </Button>
              ) : null}
            </div>

            {paymentPlan.length === 0 ? (
              <p className="text-sm text-zinc-500">No instalments configured.</p>
            ) : (
              <div className="space-y-2">
                {paymentPlan.map((row, index) => (
                  <div key={index} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[180px] flex-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={row.label}
                        onChange={(e) => updatePaymentRow(index, { label: e.target.value })}
                        disabled={!canEditBody}
                        placeholder="Deposit"
                      />
                    </div>
                    <div className="w-28">
                      <Label className="text-xs">Percent</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={row.percent}
                        onChange={(e) =>
                          updatePaymentRow(index, { percent: Number(e.target.value) || 0 })
                        }
                        disabled={!canEditBody}
                      />
                    </div>
                    {canEditBody ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePaymentRow(index)}
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4 text-zinc-400" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                <p
                  className={`text-sm ${
                    paymentPlanTotal === 100 || paymentPlan.length === 0
                      ? 'text-zinc-400'
                      : 'text-amber-300'
                  }`}
                >
                  Total: {paymentPlanTotal}%{' '}
                  {paymentPlan.length > 0 && paymentPlanTotal !== 100 ? '(must equal 100%)' : ''}
                </p>
              </div>
            )}
          </div>

          {canEditBody ? (
            <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-[var(--workspace-shell-panel)] px-4 py-3">
              <div>
                <p className="font-medium text-white">Auto-send on approval</p>
                <p className="text-sm text-zinc-400">
                  Email the recipient automatically when you sign
                </p>
              </div>
              <Switch checked={autoSendOnApproval} onCheckedChange={setAutoSendOnApproval} />
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-[var(--workspace-shell-panel)] p-4 md:p-6">
            <div className="mb-4 flex gap-2">
              {WIZARD_STEPS.map((step) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setWizardStep(step.key)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors ${
                    wizardStep === step.key
                      ? 'border-[var(--keel-teal)]/40 bg-[var(--keel-teal)]/10 text-[#97D9AA]'
                      : 'border-white/8 text-zinc-400 hover:text-white'
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </div>

            {wizardStep === 1 ? (
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Signing as</Label>
                  <PartyTypeToggle
                    value={authorType}
                    onChange={setAuthorType}
                    disabled={!canEditBody && !authorSigned}
                  />
                </div>
                <div>
                  <Label>Your name</Label>
                  <Input
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    disabled={authorSigned}
                    placeholder="Jane Smith"
                  />
                </div>
                {authorType === 'company' ? (
                  <div>
                    <Label>Your company</Label>
                    <Input
                      value={authorCompany}
                      onChange={(e) => setAuthorCompany(e.target.value)}
                      disabled={authorSigned}
                      placeholder="Acme Ltd"
                    />
                  </div>
                ) : null}
                {!authorSigned ? (
                  <Button
                    className="w-full bg-[var(--keel-teal)] text-[#09111F]"
                    onClick={() => {
                      if (validateWizard(1)) setWizardStep(2);
                    }}
                  >
                    Continue
                  </Button>
                ) : (
                  <SignatureDisplay
                    type={contract.author_signature_type}
                    data={contract.author_signature_data}
                    name={contract.author_name}
                    signedAt={contract.author_signed_at}
                  />
                )}
              </div>
            ) : null}

            {wizardStep === 2 ? (
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block">Recipient type</Label>
                  <PartyTypeToggle
                    value={recipientType}
                    onChange={setRecipientType}
                    disabled={recipientSigned}
                  />
                </div>
                <div>
                  <Label>Recipient name</Label>
                  <Input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    disabled={recipientSigned}
                  />
                </div>
                {recipientType === 'company' ? (
                  <div>
                    <Label>Recipient company</Label>
                    <Input
                      value={recipientCompany}
                      onChange={(e) => setRecipientCompany(e.target.value)}
                      disabled={recipientSigned}
                    />
                  </div>
                ) : null}
                <div>
                  <Label>Recipient email</Label>
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    disabled={recipientSigned}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setWizardStep(1)}>
                    Back
                  </Button>
                  <Button
                    className="flex-1 bg-[var(--keel-teal)] text-[#09111F]"
                    onClick={() => {
                      if (validateWizard(2)) setWizardStep(3);
                    }}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            ) : null}

            {wizardStep === 3 ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/8 bg-white/3 p-3 text-sm text-zinc-300">
                  <p>
                    <span className="text-zinc-500">Author:</span> {authorName || '—'}
                    {authorType === 'company' && authorCompany ? ` · ${authorCompany}` : ''}
                  </p>
                  <p className="mt-1">
                    <span className="text-zinc-500">Recipient:</span> {recipientName || '—'}
                    {recipientType === 'company' && recipientCompany ? ` · ${recipientCompany}` : ''}
                  </p>
                  <p className="mt-1">
                    <span className="text-zinc-500">Value:</span>{' '}
                    {formatPence(parsedTotalPence, contract.currency?.toUpperCase() ?? 'GBP')}
                  </p>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-xl border border-white/8">
                  <DocumentHtmlPreview html={contentHtml} className="border-0" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-zinc-300">Your signature</p>
                    {authorSigned ? (
                      <SignatureDisplay
                        type={contract.author_signature_type}
                        data={contract.author_signature_data}
                        name={contract.author_name}
                        signedAt={contract.author_signed_at}
                      />
                    ) : canEditContracts ? (
                      <SignatureCapture
                        defaultName={authorName}
                        loading={signing}
                        onConfirm={(result) => void handleSignAuthor(result)}
                      />
                    ) : (
                      <p className="text-sm text-zinc-500">Awaiting author signature</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-zinc-300">Recipient signature</p>
                    <SignatureDisplay
                      type={contract.recipient_signature_type}
                      data={contract.recipient_signature_data}
                      name={contract.recipient_name}
                      signedAt={contract.recipient_signed_at}
                    />
                  </div>
                </div>

                {!authorSigned ? (
                  <Button variant="outline" className="w-full" onClick={() => setWizardStep(2)}>
                    Back
                  </Button>
                ) : null}

                {contract.status === 'signed' ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--keel-teal)]/30 bg-[var(--keel-teal)]/10 px-3 py-2 text-sm text-[#97D9AA]">
                    <Check className="h-4 w-4" />
                    Fully signed by both parties
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showSendPanel && sendPanelOpen ? (
        <ContractSendPanel
          accountId={accountId}
          contractId={contract.id}
          contractTitle={title.trim() || 'Agreement'}
          totalPence={parsedTotalPence}
          currency={contract.currency}
          defaultEmail={recipientEmail}
          initialSubject={contract.email_subject}
          initialBody={contract.email_body}
          initialSignature={contract.email_signature}
          onSent={() => {
            setSendPanelOpen(false);
            router.refresh();
          }}
          onClose={() => setSendPanelOpen(false)}
        />
      ) : null}
    </div>
  );
}
