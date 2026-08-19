'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Archive,
  Copy,
  Download,
  Link2,
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

import { ConfirmSendEmailDialog } from '~/components/email/confirm-send-email-dialog';
import pathsConfig from '~/config/paths.config';
import { uniqueEmails } from '~/lib/email/unique-emails';

import { getErrorMessage } from '../_lib/error-message';
import { DEFAULT_INVOICE_EMAIL_SUBJECT } from '../_lib/invoice-smart-fields';
import {
  archiveInvoiceAction,
  deleteInvoice,
  duplicateInvoiceAction,
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
    sent_to_email?: string | null;
    sent_to_emails?: string[] | null;
    email_subject?: string | null;
    preferred_send_email?: string | null;
    public_token?: string | null;
    paymentUrl?: string | null;
  };
  canEditInvoices: boolean;
  canManageInvoiceStatus: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [resendOpen, setResendOpen] = useState(false);

  const resendRecipients = uniqueEmails(
    invoice.sent_to_emails,
    invoice.sent_to_email,
    invoice.preferred_send_email,
  );
  const resendSubject = (
    invoice.email_subject?.trim() || DEFAULT_INVOICE_EMAIL_SUBJECT
  ).replaceAll('{{invoice.number}}', invoice.invoice_number);

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
      if (key === 'delete') {
        router.push(
          pathsConfig.app.accountInvoices.replace('[account]', accountSlug),
        );
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const editPath = pathsConfig.app.accountInvoiceEdit
    .replace('[account]', accountSlug)
    .replace('[id]', invoice.id);

  const paymentPageUrl =
    invoice.paymentUrl?.trim() ||
    (invoice.public_token
      ? `/portal/invoices/${encodeURIComponent(invoice.public_token)}`
      : null);

  const handleCopyPaymentUrl = async () => {
    if (!paymentPageUrl) return;
    try {
      const url = paymentPageUrl.startsWith('http')
        ? paymentPageUrl
        : `${window.location.origin}${paymentPageUrl}`;
      await navigator.clipboard.writeText(url);
      toast.success('Payment page URL copied');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

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
          {canEditInvoices ? (
            <DropdownMenuItem
              onClick={() =>
                run(
                  'duplicate',
                  () =>
                    duplicateInvoiceAction({
                      accountId,
                      invoiceId: invoice.id,
                    }),
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
          {paymentPageUrl ? (
            <DropdownMenuItem
              data-test="copy-invoice-payment-url"
              onClick={() => void handleCopyPaymentUrl()}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Copy payment page URL
            </DropdownMenuItem>
          ) : null}
          {canEditInvoices && ['sent', 'read'].includes(invoice.status) ? (
            <DropdownMenuItem onClick={() => setResendOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Resend
            </DropdownMenuItem>
          ) : null}
          {canManageInvoiceStatus &&
          ['sent', 'read'].includes(invoice.status) ? (
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
                    () =>
                      voidInvoiceAction({ accountId, invoiceId: invoice.id }),
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

      <ConfirmSendEmailDialog
        open={resendOpen}
        onOpenChange={setResendOpen}
        title="Resend this invoice?"
        documentLabel={`Invoice ${invoice.invoice_number}`}
        recipients={resendRecipients}
        subject={resendSubject}
        confirmLabel="Resend email"
        pending={loading === 'resend'}
        onConfirm={() => {
          void (async () => {
            setLoading('resend');
            try {
              await resendInvoiceAction({
                accountId,
                invoiceId: invoice.id,
              });
              toast.success('Invoice resent');
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
