'use client';

import { useCallback, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowLeft, Eye, Loader2, Send } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import { DocumentRichTextEditor } from '~/components/document-rich-text';
import pathsConfig from '~/config/paths.config';
import { formatPence } from '~/home/[account]/invoices/_lib/invoice-totals';

import { getErrorMessage } from '../_lib/error-message';
import { updateProposal } from '../_lib/server/server-actions';
import { ProposalRowMenu } from './proposal-row-menu';
import { ProposalSendPanel } from './proposal-send-panel';

type ClientInfo = {
  id: string;
  display_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email?: string | null;
};

type DealInfo = {
  id: string;
  name: string | null;
  contact_name: string | null;
  company_name: string | null;
  value?: number | null;
};

type ProposalData = {
  id: string;
  account_id: string;
  client_id: string | null;
  deal_id: string | null;
  title: string | null;
  content_html: string | null;
  status: string;
  recipient_name: string | null;
  recipient_email: string | null;
  total_pence: number | null;
  currency: string | null;
  expires_at: string | null;
  private_note: string | null;
  email_subject: string | null;
  email_body: string | null;
  email_signature: string | null;
  sent_to_email: string | null;
  client: ClientInfo | null;
  deal: DealInfo | null;
};

const STATUS_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'read', label: 'Read' },
  { key: 'approved', label: 'Approved' },
] as const;

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function statusStepIndex(status: string): number {
  if (status === 'approved') return 3;
  if (status === 'declined') return 2;
  if (status === 'read') return 2;
  if (status === 'sent') return 1;
  return 0;
}

function penceToPoundsInput(pence: number | null): string {
  if (pence == null || pence === 0) return '';
  return (pence / 100).toFixed(2);
}

function poundsInputToPence(value: string): number | null {
  const v = parseFloat(value);
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * 100);
}

export function ProposalEditContent({
  accountSlug,
  accountId,
  proposal: initialProposal,
  brandLogoUrl,
  canEditProposals,
  canManageProposalStatus,
}: {
  accountSlug: string;
  accountId: string;
  proposal: Record<string, unknown>;
  brandLogoUrl?: string | null;
  canEditProposals: boolean;
  canManageProposalStatus: boolean;
}) {
  const router = useRouter();
  const proposal = initialProposal as unknown as ProposalData;
  const proposalsPath = pathsConfig.app.accountProposals.replace('[account]', accountSlug);

  const isDraft = proposal.status === 'draft';
  const isLocked = proposal.status !== 'draft';
  const canModify = canEditProposals && isDraft;
  const currentStep = statusStepIndex(proposal.status);

  const [previewMode, setPreviewMode] = useState(false);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(proposal.title ?? '');
  const [contentHtml, setContentHtml] = useState(proposal.content_html ?? '');
  const [recipientName, setRecipientName] = useState(proposal.recipient_name ?? '');
  const [recipientEmail, setRecipientEmail] = useState(proposal.recipient_email ?? '');
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(proposal.expires_at));
  const [privateNote, setPrivateNote] = useState(proposal.private_note ?? '');
  const [totalPenceInput, setTotalPenceInput] = useState(penceToPoundsInput(proposal.total_pence));
  const [emailSubject, setEmailSubject] = useState(proposal.email_subject ?? '');
  const [emailBody, setEmailBody] = useState(proposal.email_body ?? '');
  const [emailSignature, setEmailSignature] = useState(proposal.email_signature ?? '');

  const readOnly = previewMode || !canModify;

  const defaultRecipientName =
    recipientName.trim() ||
    proposal.client?.display_name?.trim() ||
    proposal.deal?.contact_name?.trim() ||
    proposal.deal?.company_name?.trim() ||
    '';

  const defaultSendEmail =
    proposal.sent_to_email ??
    (recipientEmail.trim() ||
      proposal.client?.email?.trim() ||
      '');

  const handleSave = useCallback(async () => {
    if (!canModify) return;
    setSaving(true);
    try {
      await updateProposal({
        accountId,
        proposalId: proposal.id,
        title: title.trim() || null,
        content_html: contentHtml,
        recipient_name: recipientName.trim() || null,
        recipient_email: recipientEmail.trim() || null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        private_note: privateNote.trim() || null,
        total_pence: poundsInputToPence(totalPenceInput),
        email_subject: emailSubject.trim() || null,
        email_body: emailBody.trim() || null,
        email_signature: emailSignature.trim() || null,
      });
      toast.success('Proposal saved');
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [
    accountId,
    canModify,
    contentHtml,
    emailBody,
    emailSignature,
    emailSubject,
    expiresAt,
    privateNote,
    proposal.id,
    recipientEmail,
    recipientName,
    router,
    title,
    totalPenceInput,
  ]);

  const canvasClassName =
    'relative rounded-xl border border-zinc-200 bg-white p-8 text-[#1E293B] shadow-sm';

  const inputClassName =
    'border-zinc-200 bg-white text-[#1E293B] placeholder:text-zinc-400';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-zinc-400 hover:text-white"
          >
            <Link href={proposalsPath}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to proposals
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
              <Eye className="h-4 w-4 text-zinc-400" />
              <Label htmlFor="preview-mode" className="text-sm text-zinc-300">
                Preview
              </Label>
              <Switch
                id="preview-mode"
                checked={previewMode}
                onCheckedChange={setPreviewMode}
              />
            </div>

            {canEditProposals ? (
              <>
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={saving || !canModify}
                  className="bg-[var(--keel-teal)] hover:bg-[#238b7f]"
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>

                {isDraft ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-zinc-200 hover:bg-[var(--workspace-shell-panel-hover)]"
                    onClick={() => setShowSendPanel(true)}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send proposal
                  </Button>
                ) : null}
              </>
            ) : null}

            <ProposalRowMenu
              accountId={accountId}
              accountSlug={accountSlug}
              proposal={{ id: proposal.id, status: proposal.status, title: proposal.title }}
              canEditProposals={canEditProposals}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">
              {title.trim() || 'Untitled proposal'}
              {proposal.total_pence != null
                ? ` · ${formatPence(proposal.total_pence, proposal.currency ?? 'GBP')}`
                : ''}
            </h1>
            {defaultRecipientName ? (
              <p className="mt-1 text-sm text-zinc-400">For {defaultRecipientName}</p>
            ) : null}
          </div>

          <ol className="flex flex-wrap items-center gap-1 text-xs sm:gap-2">
            {STATUS_STEPS.map((step, index) => {
              const active = index === currentStep;
              const complete = index < currentStep;
              const declined = proposal.status === 'declined' && step.key === 'approved';
              return (
                <li key={step.key} className="flex items-center gap-1 sm:gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 font-medium ${
                      declined
                        ? 'bg-[#E85D75]/20 text-[#F6A7B5]'
                        : active
                          ? 'bg-[var(--keel-teal)]/20 text-[#5eead4]'
                          : complete
                            ? 'bg-white/10 text-zinc-300'
                            : 'bg-white/5 text-zinc-500'
                    }`}
                  >
                    {declined ? 'Declined' : step.label}
                  </span>
                  {index < STATUS_STEPS.length - 1 ? (
                    <span className="hidden text-zinc-600 sm:inline">→</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      {isLocked ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {proposal.status === 'approved'
            ? 'This proposal has been approved and is locked.'
            : proposal.status === 'declined'
              ? 'This proposal was declined and is no longer editable.'
              : 'This proposal has been sent. Content is read-only — use the menu to resend or export.'}
        </div>
      ) : null}

      {showSendPanel && isDraft ? (
        <ProposalSendPanel
          accountId={accountId}
          proposalId={proposal.id}
          proposalTitle={title.trim() || 'Proposal'}
          totalPence={poundsInputToPence(totalPenceInput) ?? proposal.total_pence}
          currency={proposal.currency}
          defaultEmail={defaultSendEmail}
          initialSubject={emailSubject}
          initialBody={emailBody}
          initialSignature={emailSignature}
          onSent={() => {
            setShowSendPanel(false);
            router.refresh();
          }}
          onClose={() => setShowSendPanel(false)}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className={canvasClassName}>
            {brandLogoUrl ? (
              <div className="absolute right-8 top-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandLogoUrl}
                  alt="Brand logo"
                  className="h-12 w-auto max-w-[120px] object-contain object-right"
                />
              </div>
            ) : null}

            <div className="space-y-6 pr-0 sm:pr-32">
              <div>
                {readOnly ? (
                  <h2 className="text-2xl font-bold text-[#1E293B]">
                    {title.trim() || 'Untitled proposal'}
                  </h2>
                ) : (
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Proposal title"
                    className={`text-2xl font-bold ${inputClassName}`}
                  />
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-zinc-600">Recipient name</Label>
                  <Input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    disabled={readOnly}
                    placeholder={defaultRecipientName || 'Client name'}
                    className={`mt-1 ${inputClassName}`}
                  />
                </div>
                <div>
                  <Label className="text-zinc-600">Recipient email</Label>
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    disabled={readOnly}
                    placeholder={proposal.client?.email ?? 'client@example.com'}
                    className={`mt-1 ${inputClassName}`}
                  />
                </div>
              </div>

              <div className="max-w-xs">
                <Label className="text-zinc-600">Expires</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  disabled={readOnly}
                  className={`mt-1 ${inputClassName}`}
                />
              </div>

              <div>
                <Label className="mb-2 block text-zinc-600">Proposal content</Label>
                <DocumentRichTextEditor
                  value={contentHtml}
                  onChange={setContentHtml}
                  readOnly={readOnly}
                  minHeight={360}
                  placeholder="Write your proposal…"
                />
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-white/10 bg-[var(--workspace-shell-panel)] p-4">
              <h2 className="text-sm font-semibold text-white">Private note</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Only visible to your team — not shown to clients.
              </p>
              <Textarea
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                disabled={readOnly}
                rows={5}
                placeholder="Internal notes about this proposal"
                className="mt-3 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-white"
              />
            </section>

            <section className="rounded-xl border border-white/10 bg-[var(--workspace-shell-panel)] p-4">
              <h2 className="text-sm font-semibold text-white">Total (optional)</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Shown in emails and on the client portal.
              </p>
              <div className="relative mt-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">£</span>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={totalPenceInput}
                  onChange={(e) => setTotalPenceInput(e.target.value)}
                  disabled={readOnly}
                  placeholder="0.00"
                  className="border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] pl-7 text-white"
                />
              </div>
            </section>

            {canManageProposalStatus ? (
              <section className="rounded-xl border border-white/10 bg-[var(--workspace-shell-panel)] p-4">
                <h2 className="text-sm font-semibold text-white">Email templates</h2>
                <p className="mt-1 text-xs text-zinc-400">Used when sending this proposal.</p>
                <div className="mt-4 space-y-3">
                  <div>
                    <Label className="text-zinc-300">Subject</Label>
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      disabled={readOnly}
                      className="mt-1 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Body</Label>
                    <Textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      disabled={readOnly}
                      rows={3}
                      className="mt-1 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Signature</Label>
                    <Textarea
                      value={emailSignature}
                      onChange={(e) => setEmailSignature(e.target.value)}
                      disabled={readOnly}
                      rows={2}
                      className="mt-1 border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-white"
                    />
                  </div>
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
