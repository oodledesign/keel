'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Archive,
  Copy,
  Download,
  FileText,
  Loader2,
  MoreVertical,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';

import { getErrorMessage } from '../_lib/error-message';
import {
  archiveContract,
  deleteContract,
  duplicateContract,
  generateInvoicesFromPaymentPlan,
  sendContractReminder,
  setContractStatus,
} from '../_lib/server/server-actions';

type PendingAction = 'cancel' | 'delete' | null;

export function ContractRowMenu({
  accountId,
  accountSlug,
  contract,
  canEditContracts,
  canManageContractStatus,
  onChanged,
}: {
  accountId: string;
  accountSlug: string;
  contract: {
    id: string;
    status: string;
    title?: string | null;
    author_signed_at?: string | null;
    recipient_signed_at?: string | null;
    archived_at?: string | null;
    email_delivery_status?: string | null;
    sent_to_email?: string | null;
    recipient_email?: string | null;
    payment_plan?: unknown;
  };
  canEditContracts: boolean;
  canManageContractStatus: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

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

  const editPath = pathsConfig.app.accountContractEdit
    .replace('[account]', accountSlug)
    .replace('[id]', contract.id);

  const hasPaymentPlan =
    Array.isArray(contract.payment_plan) && contract.payment_plan.length > 0;

  const contractLabel = contract.title?.trim() || 'this agreement';

  const handleConfirmCancel = () =>
    run(
      'cancel',
      () =>
        setContractStatus({
          accountId,
          contractId: contract.id,
          status: 'cancelled',
        }),
      'Contract cancelled',
    ).then(() => setPendingAction(null));

  const handleConfirmDelete = () =>
    run(
      'delete',
      () => deleteContract({ accountId, contractId: contract.id }),
      'Contract deleted',
    ).then(() => setPendingAction(null));

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
          {canEditContracts ? (
            <DropdownMenuItem
              onClick={() =>
                run(
                  'duplicate',
                  () =>
                    duplicateContract({ accountId, contractId: contract.id }),
                  'Contract duplicated as a draft',
                )
              }
            >
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
          ) : null}
          {canEditContracts ? (
            <DropdownMenuItem
              onClick={() =>
                run(
                  'archive',
                  () =>
                    archiveContract({
                      accountId,
                      contractId: contract.id,
                      archived: !contract.archived_at,
                    }),
                  contract.archived_at
                    ? 'Contract restored'
                    : 'Contract archived',
                )
              }
            >
              {contract.archived_at ? (
                <RotateCcw className="mr-2 h-4 w-4" />
              ) : (
                <Archive className="mr-2 h-4 w-4" />
              )}
              {contract.archived_at ? 'Restore' : 'Archive'}
            </DropdownMenuItem>
          ) : null}
          {canEditContracts &&
          ['ready_to_sign', 'sent'].includes(contract.status) &&
          contract.author_signed_at &&
          !contract.recipient_signed_at ? (
            <DropdownMenuItem
              onClick={() =>
                run(
                  'reminder',
                  () =>
                    sendContractReminder({
                      accountId,
                      contractId: contract.id,
                      sent_to_email:
                        contract.sent_to_email ||
                        contract.recipient_email ||
                        undefined,
                      kind:
                        contract.email_delivery_status === 'failed'
                          ? 'resend'
                          : 'reminder',
                    }),
                  contract.email_delivery_status === 'failed'
                    ? 'Contract resent'
                    : 'Reminder sent',
                )
              }
            >
              <Send className="mr-2 h-4 w-4" />
              {contract.email_delivery_status === 'failed'
                ? 'Resend email'
                : 'Send reminder'}
            </DropdownMenuItem>
          ) : null}
          {canEditContracts && contract.author_signed_at ? (
            <DropdownMenuItem onClick={() => router.push(`${editPath}?send=1`)}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <a
              href={`/api/contracts/pdf?contractId=${contract.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="mr-2 h-4 w-4" />
              Export to PDF
            </a>
          </DropdownMenuItem>
          {canEditContracts &&
          contract.status === 'signed' &&
          contract.author_signed_at &&
          contract.recipient_signed_at &&
          hasPaymentPlan ? (
            <DropdownMenuItem
              onClick={() =>
                run(
                  'invoices',
                  () =>
                    generateInvoicesFromPaymentPlan({
                      accountId,
                      contractId: contract.id,
                    }),
                  'Instalment invoices generated',
                )
              }
            >
              <FileText className="mr-2 h-4 w-4" />
              Generate invoices
            </DropdownMenuItem>
          ) : null}
          {canManageContractStatus &&
          ['draft', 'ready_to_sign', 'sent'].includes(contract.status) ? (
            <DropdownMenuItem onClick={() => setPendingAction('cancel')}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </DropdownMenuItem>
          ) : null}
          {canEditContracts && contract.status === 'draft' ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-400 focus:text-red-300"
                onClick={() => setPendingAction('delete')}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pendingAction === 'cancel'}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--workspace-shell-text)]">
              Cancel contract?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--workspace-shell-text-muted)]">
              This marks{' '}
              <span className="font-medium text-[var(--workspace-shell-text)]">
                {contractLabel}
              </span>{' '}
              as cancelled and revokes any shareable link. This can&apos;t be
              undone from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={loading === 'cancel'}
              className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
            >
              Keep contract
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={loading === 'cancel'}
              onClick={() => void handleConfirmCancel()}
            >
              {loading === 'cancel' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Cancel contract
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingAction === 'delete'}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--workspace-shell-text)]">
              Delete contract?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--workspace-shell-text-muted)]">
              This permanently deletes{' '}
              <span className="font-medium text-[var(--workspace-shell-text)]">
                {contractLabel}
              </span>
              . Only draft contracts can be deleted, and this can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={loading === 'delete'}
              className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
            >
              Keep contract
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={loading === 'delete'}
              onClick={() => void handleConfirmDelete()}
            >
              {loading === 'delete' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete contract
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
