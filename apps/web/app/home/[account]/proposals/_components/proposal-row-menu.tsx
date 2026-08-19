'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Copy,
  Download,
  Loader2,
  MoreVertical,
  Send,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';

import { ConfirmSendEmailDialog } from '~/components/email/confirm-send-email-dialog';
import pathsConfig from '~/config/paths.config';
import { uniqueEmails } from '~/lib/email/unique-emails';

import { DEFAULT_PROPOSAL_EMAIL_SUBJECT } from '../_lib/doc-smart-fields';
import { getErrorMessage } from '../_lib/error-message';
import {
  deleteProposal,
  duplicateProposalAction,
  resendProposalAction,
} from '../_lib/server/server-actions';

export function ProposalRowMenu({
  accountId,
  accountSlug,
  proposal,
  canEditProposals,
  onChanged,
}: {
  accountId: string;
  accountSlug: string;
  proposal: {
    id: string;
    status: string;
    title?: string | null;
    sent_to_email?: string | null;
    email_subject?: string | null;
  };
  canEditProposals: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [resendOpen, setResendOpen] = useState(false);
  const proposalTitle = proposal.title?.trim() || 'Untitled proposal';
  const resendRecipients = uniqueEmails(proposal.sent_to_email);
  const resendSubject = (
    proposal.email_subject?.trim() || DEFAULT_PROPOSAL_EMAIL_SUBJECT
  ).replaceAll('{{proposal.title}}', proposalTitle);

  const run = async (
    key: string,
    fn: () => Promise<unknown>,
    success: string,
  ) => {
    setLoading(key);
    try {
      await fn();
      toast.success(success);
      onChanged?.();
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const editPath = pathsConfig.app.accountProposalEdit
    .replace('[account]', accountSlug)
    .replace('[id]', proposal.id);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
        >
          <DropdownMenuItem onClick={() => router.push(editPath)}>
            Open
          </DropdownMenuItem>
          {canEditProposals ? (
            <DropdownMenuItem
              onClick={() =>
                run(
                  'duplicate',
                  () =>
                    duplicateProposalAction({
                      accountId,
                      proposalId: proposal.id,
                    }),
                  'Proposal duplicated',
                )
              }
            >
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <a
              href={`/api/proposals/pdf?proposalId=${proposal.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="mr-2 h-4 w-4" />
              Export to PDF
            </a>
          </DropdownMenuItem>
          {canEditProposals && ['sent', 'read'].includes(proposal.status) ? (
            <DropdownMenuItem onClick={() => setResendOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Resend
            </DropdownMenuItem>
          ) : null}
          {canEditProposals && proposal.status === 'draft' ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-400 focus:text-red-300"
                onClick={() =>
                  run(
                    'delete',
                    () =>
                      deleteProposal({ accountId, proposalId: proposal.id }),
                    'Proposal deleted',
                  )
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmSendEmailDialog
        open={resendOpen}
        onOpenChange={setResendOpen}
        title="Resend this proposal?"
        documentLabel={proposalTitle}
        recipients={resendRecipients}
        subject={resendSubject}
        confirmLabel="Resend email"
        pending={loading === 'resend'}
        onConfirm={() => {
          void (async () => {
            setLoading('resend');
            try {
              await resendProposalAction({
                accountId,
                proposalId: proposal.id,
              });
              toast.success('Proposal resent');
              setResendOpen(false);
              onChanged?.();
              router.refresh();
            } catch (error) {
              toast.error(getErrorMessage(error));
            } finally {
              setLoading(null);
            }
          })();
        }}
      />
    </>
  );
}
