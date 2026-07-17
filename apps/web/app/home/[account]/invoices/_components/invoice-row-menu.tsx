'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Archive,
  Copy,
  Download,
  Loader2,
  MoreVertical,
  Send,
  Trash2,
  XCircle,
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

import pathsConfig from '~/config/paths.config';

import { getErrorMessage } from '../_lib/error-message';
import {
  archiveInvoiceAction,
  deleteInvoice,
  duplicateInvoiceAction,
  getInvoicePortalLink,
  resendInvoiceAction,
  setInvoiceStatus,
  voidInvoiceAction,
} from '../_lib/server/server-actions';

export function InvoiceRowMenu({
  accountId,
  accountSlug,
  invoice,
  canEditInvoices,
  canManageInvoiceStatus,
  onChanged,
}: {
  accountId: string;
  accountSlug: string;
  invoice: {
    id: string;
    status: string;
    invoice_number: string;
  };
  canEditInvoices: boolean;
  canManageInvoiceStatus: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

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

  const editPath = pathsConfig.app.accountInvoiceEdit
    .replace('[account]', accountSlug)
    .replace('[id]', invoice.id);

  return (
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
        {canEditInvoices ? (
          <DropdownMenuItem
            onClick={() =>
              run(
                'duplicate',
                () =>
                  duplicateInvoiceAction({ accountId, invoiceId: invoice.id }),
                'Invoice duplicated',
              )
            }
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <a
            href={`/api/invoices/pdf?invoiceId=${invoice.id}`}
            target="_blank"
            rel="noreferrer"
          >
            <Download className="mr-2 h-4 w-4" />
            Export to PDF
          </a>
        </DropdownMenuItem>
        {canEditInvoices && ['sent', 'read'].includes(invoice.status) ? (
          <DropdownMenuItem
            onClick={() =>
              run(
                'resend',
                () => resendInvoiceAction({ accountId, invoiceId: invoice.id }),
                'Invoice resent',
              )
            }
          >
            <Send className="mr-2 h-4 w-4" />
            Resend
          </DropdownMenuItem>
        ) : null}
        {canManageInvoiceStatus && ['sent', 'read'].includes(invoice.status) ? (
          <>
            <DropdownMenuItem
              onClick={() =>
                run(
                  'paid',
                  () =>
                    setInvoiceStatus({
                      accountId,
                      invoiceId: invoice.id,
                      status: 'paid',
                      payment_method: 'bank_transfer',
                    }),
                  'Marked as paid in full',
                )
              }
            >
              Mark as paid in full
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                run(
                  'void',
                  () => voidInvoiceAction({ accountId, invoiceId: invoice.id }),
                  'Invoice voided',
                )
              }
            >
              <XCircle className="mr-2 h-4 w-4" />
              Void
            </DropdownMenuItem>
          </>
        ) : null}
        {canEditInvoices ? (
          <DropdownMenuItem
            onClick={() =>
              run(
                'archive',
                () =>
                  archiveInvoiceAction({
                    accountId,
                    invoiceId: invoice.id,
                    archived: true,
                  }),
                'Invoice archived',
              )
            }
          >
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </DropdownMenuItem>
        ) : null}
        {canEditInvoices && invoice.status === 'draft' ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-400 focus:text-red-300"
              onClick={() =>
                run(
                  'delete',
                  () => deleteInvoice({ accountId, invoiceId: invoice.id }),
                  'Invoice deleted',
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
  );
}
