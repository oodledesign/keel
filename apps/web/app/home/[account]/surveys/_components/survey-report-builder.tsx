'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import {
  Download,
  ListChecks,
  Loader2,
  Mail,
  Pencil,
  Send,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { ProposalEditAiAssist } from '~/home/[account]/proposals/_components/proposal-edit-ai-assist';
import { ProposalRowMenu } from '~/home/[account]/proposals/_components/proposal-row-menu';
import { ProposalSendPanel } from '~/home/[account]/proposals/_components/proposal-send-panel';
import { SurveyPhotosPanel } from '~/home/[account]/proposals/_components/survey-photos-panel';
import { getErrorMessage } from '~/home/[account]/proposals/_lib/error-message';
import {
  sendProposal,
  updateProposal,
} from '~/home/[account]/proposals/_lib/server/server-actions';
import { compileSurveyReportDocument } from '~/lib/building-surveyor/compile-survey-report-document';
import {
  type SurveyReportDocument,
  resolveSurveyReportDocument,
} from '~/lib/building-surveyor/survey-report-document';
import type { SurveyGapCheckResult } from '~/lib/building-surveyor/survey-report-gap-check';
import {
  useFormDirtyState,
  useUnsavedChangesWarning,
} from '~/lib/hooks/use-unsaved-changes-warning';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { checkSurveyPublishGapsAction } from '../_lib/server/survey-capture-actions';
import { surveyClientName } from '../_lib/survey-display';
import { SurveyReportBodyEditor } from './survey-report-body-editor';
import { SurveyWorkspaceHeader } from './survey-workspace-header';

type SurveyBuilderProposal = {
  id: string;
  client_id: string | null;
  deal_id: string | null;
  title: string | null;
  content_html: string | null;
  body_document?: unknown;
  status: string;
  recipient_name: string | null;
  recipient_email: string | null;
  total_pence: number | null;
  currency: string | null;
  private_note: string | null;
  email_subject: string | null;
  email_body: string | null;
  email_signature: string | null;
  sent_to_email: string | null;
  preferred_send_email?: string | null;
  client: {
    id: string;
    display_name: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
    email?: string | null;
  } | null;
  deal: {
    id: string;
    name: string | null;
    contact_name: string | null;
    company_name: string | null;
    value?: number | null;
  } | null;
};

type DealOption = {
  id: string;
  contactName: string;
  companyName: string;
  value: number;
};

const outlineBtn =
  'h-9 rounded-xl border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-panel-hover)]';

const controlInput =
  'border border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]';

export function SurveyReportBuilder({
  accountSlug,
  accountId,
  accountName,
  senderName,
  proposal: initialProposal,
  canEdit,
  deals,
}: {
  accountSlug: string;
  accountId: string;
  accountName: string;
  senderName: string;
  proposal: Record<string, unknown>;
  canEdit: boolean;
  deals: DealOption[];
}) {
  const router = useRouter();
  const proposal = initialProposal as unknown as SurveyBuilderProposal;
  const isDraft = proposal.status === 'draft';
  const canModify = canEdit && isDraft;

  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState(false);
  const [gapPending, startGapCheck] = useTransition();
  const [gapResult, setGapResult] = useState<
    (SurveyGapCheckResult & { source?: string; usedAi: boolean }) | null
  >(null);

  const [reportDocument, setReportDocument] = useState<SurveyReportDocument>(
    () =>
      resolveSurveyReportDocument(
        proposal.body_document,
        proposal.content_html ?? '',
      ),
  );
  const [recipientName, setRecipientName] = useState(
    proposal.recipient_name ?? '',
  );
  const [recipientEmail, setRecipientEmail] = useState(
    proposal.recipient_email ??
      proposal.preferred_send_email ??
      proposal.client?.email ??
      '',
  );
  const [privateNote, setPrivateNote] = useState(proposal.private_note ?? '');

  const dirtyFingerprint = useMemo(
    () => ({ reportDocument, recipientName, recipientEmail, privateNote }),
    [reportDocument, recipientName, recipientEmail, privateNote],
  );
  const { isDirty, markClean } = useFormDirtyState(dirtyFingerprint, {
    enabled: canModify,
  });
  useUnsavedChangesWarning(isDirty);

  const clientName = surveyClientName(proposal);
  const displayRecipientName = recipientName.trim() || clientName || '';
  const title = proposal.title?.trim() || 'Building survey';
  const pdfHref = `/api/proposals/pdf?proposalId=${proposal.id}`;

  const save = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!canModify) return true;
      setSaving(true);
      try {
        await updateProposal({
          accountId,
          proposalId: proposal.id,
          content_html: compileSurveyReportDocument(reportDocument),
          body_document: reportDocument,
          recipient_name: recipientName.trim() || null,
          recipient_email: recipientEmail.trim() || null,
          private_note: privateNote.trim() || null,
        });
        markClean();
        if (!quiet) toast.success('Report saved');
        router.refresh();
        return true;
      } catch (err) {
        toast.error(getErrorMessage(err));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      accountId,
      canModify,
      markClean,
      privateNote,
      proposal.id,
      recipientEmail,
      recipientName,
      reportDocument,
      router,
    ],
  );

  const handleSendTest = async () => {
    if (isDirty && !(await save({ quiet: true }))) return;
    setSendingTest(true);
    try {
      await sendProposal({
        accountId,
        proposalId: proposal.id,
        sent_to_email: recipientEmail.trim() || 'test@example.com',
        send_test_to_self: true,
      });
      toast.success('Test email sent to you');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSendingTest(false);
    }
  };

  const handleOpenSend = async () => {
    if (isDirty && !(await save({ quiet: true }))) return;
    setShowSendPanel(true);
  };

  const runGapCheck = (useAi: boolean) => {
    startGapCheck(async () => {
      try {
        const next = await checkSurveyPublishGapsAction({
          accountId,
          accountSlug,
          proposalId: proposal.id,
          useAi,
        });
        setGapResult({ ...next, usedAi: useAi });
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    });
  };

  const headerActions = (
    <>
      {canModify ? (
        <ProposalEditAiAssist
          accountSlug={accountSlug}
          accountId={accountId}
          accountName={accountName}
          senderName={senderName}
          recipientName={recipientName}
          recipientCompany={
            proposal.client?.company_name ?? proposal.deal?.company_name ?? null
          }
          clientId={proposal.client_id}
          dealId={proposal.deal_id}
          dealValue={
            proposal.deal?.value ??
            (proposal.total_pence != null ? proposal.total_pence / 100 : null)
          }
          contentHtml={compileSurveyReportDocument(reportDocument)}
          deals={deals}
          disabled={saving}
          documentKind="survey_report"
          proposalId={proposal.id}
          onContentApplied={() => undefined}
          onDocumentApplied={setReportDocument}
        />
      ) : null}
      {canModify ? (
        <Button
          size="sm"
          variant="outline"
          className={outlineBtn}
          onClick={() => void save()}
          disabled={saving || !isDirty}
          data-test="survey-builder-save"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isDirty ? 'Save' : 'Saved'}
        </Button>
      ) : null}
      {canEdit && isDraft ? (
        <button
          type="button"
          className={workspaceBtnPrimaryMd}
          onClick={() => void handleOpenSend()}
          disabled={saving}
          data-test="survey-builder-send"
        >
          <Send className="h-4 w-4" />
          Send report
        </button>
      ) : null}
      <ProposalRowMenu
        accountId={accountId}
        accountSlug={accountSlug}
        proposal={{
          id: proposal.id,
          status: proposal.status,
          title: proposal.title,
          sent_to_email: proposal.sent_to_email,
          email_subject: proposal.email_subject,
        }}
        documentKind="survey_report"
        canEditProposals={canEdit}
      />
    </>
  );

  return (
    <div className="flex w-full flex-col gap-5">
      <SurveyWorkspaceHeader
        accountSlug={accountSlug}
        proposalId={proposal.id}
        title={title}
        clientName={clientName}
        status={proposal.status}
        actions={headerActions}
      />

      {!isDraft ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          This report has been sent, so the content is read-only. Use the menu
          to resend or download it.
        </div>
      ) : null}

      {showSendPanel && isDraft ? (
        <ProposalSendPanel
          accountId={accountId}
          proposalId={proposal.id}
          proposalTitle={title}
          totalPence={null}
          currency={proposal.currency}
          defaultEmail={recipientEmail.trim()}
          initialSubject={proposal.email_subject}
          initialBody={proposal.email_body}
          initialSignature={proposal.email_signature}
          documentKind="survey_report"
          onSent={() => {
            setShowSendPanel(false);
            router.refresh();
          }}
          onClose={() => setShowSendPanel(false)}
        />
      ) : (
        <>
          <section
            className={`${workspacePanelCard} flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between`}
            data-test="survey-builder-toolbar"
          >
            {editingRecipient && canModify ? (
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label className={`text-xs ${workspaceTextMuted}`}>
                    Recipient name
                  </Label>
                  <Input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={clientName ?? 'Client name'}
                    className={`mt-1 h-8 ${controlInput}`}
                  />
                </div>
                <div className="flex-1">
                  <Label className={`text-xs ${workspaceTextMuted}`}>
                    Recipient email
                  </Label>
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder={proposal.client?.email ?? 'client@example.com'}
                    className={`mt-1 h-8 ${controlInput}`}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => setEditingRecipient(false)}
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <Mail
                  className={`h-4 w-4 shrink-0 ${workspaceTextMuted}`}
                  aria-hidden
                />
                <span className={workspaceTextMuted}>To</span>
                <span className="truncate text-[var(--workspace-shell-text)]">
                  {displayRecipientName || 'No recipient yet'}
                  {recipientEmail.trim() ? (
                    <span className={workspaceTextMuted}>
                      {' '}
                      · {recipientEmail.trim()}
                    </span>
                  ) : null}
                </span>
                {canModify ? (
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 text-xs ${workspaceTextMuted} hover:text-[var(--workspace-shell-text)]`}
                    onClick={() => setEditingRecipient(true)}
                    data-test="survey-builder-edit-recipient"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {canEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  className={outlineBtn}
                  disabled={gapPending}
                  onClick={() => runGapCheck(false)}
                  data-test="survey-builder-gap-check"
                >
                  {gapPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ListChecks className="mr-2 h-4 w-4" />
                  )}
                  Check for gaps
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className={outlineBtn}
                asChild
              >
                <a href={pdfHref} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </a>
              </Button>
              {canEdit && isDraft ? (
                <Button
                  size="sm"
                  variant="outline"
                  className={outlineBtn}
                  disabled={sendingTest || saving}
                  onClick={() => void handleSendTest()}
                  data-test="survey-builder-send-test"
                >
                  {sendingTest ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Send test to me
                </Button>
              ) : null}
            </div>
          </section>

          {gapResult ? (
            <section
              className={`${workspacePanelCard} space-y-2 p-4`}
              data-test="survey-builder-gap-results"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                  {gapResult.readyToPublish
                    ? 'No gaps found'
                    : `${gapResult.flags.length} gap${gapResult.flags.length === 1 ? '' : 's'} to look at`}
                </h2>
                <button
                  type="button"
                  aria-label="Dismiss gap check"
                  className={`${workspaceTextMuted} hover:text-[var(--workspace-shell-text)]`}
                  onClick={() => setGapResult(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {gapResult.readyToPublish ? (
                <p className={`text-xs ${workspaceTextMuted}`}>
                  Every section has content and the photos match their text.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {gapResult.flags.map((flag) => (
                    <li
                      key={`${flag.kind}-${flag.sectionKey}`}
                      className={workspaceTextMuted}
                    >
                      <span className="font-medium text-[var(--workspace-shell-text)]">
                        {flag.ricsCode || flag.label}
                      </span>
                      {' — '}
                      {flag.detail}
                    </li>
                  ))}
                </ul>
              )}
              {!gapResult.usedAi ? (
                <button
                  type="button"
                  className="text-xs text-[var(--ozer-accent-muted)] hover:underline"
                  disabled={gapPending}
                  onClick={() => runGapCheck(true)}
                >
                  Also run an AI consistency check (uses Ozer credits)
                </button>
              ) : null}
            </section>
          ) : null}

          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <SurveyReportBodyEditor
              document={reportDocument}
              accountId={accountId}
              proposalId={proposal.id}
              disabled={!canModify}
              onChange={setReportDocument}
            />

            <aside className="space-y-4">
              <SurveyPhotosPanel
                accountId={accountId}
                accountSlug={accountSlug}
                proposalId={proposal.id}
                clientId={proposal.client_id}
                canEdit={canModify}
              />

              <section className={`${workspacePanelCard} p-4`}>
                <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                  Private note
                </h2>
                <p className={`mt-1 text-xs ${workspaceTextMuted}`}>
                  Only your team sees this. It is not shown to the client.
                </p>
                <Textarea
                  value={privateNote}
                  onChange={(e) => setPrivateNote(e.target.value)}
                  disabled={!canModify}
                  rows={4}
                  placeholder="Internal notes about this report"
                  className={`mt-3 ${controlInput}`}
                />
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
