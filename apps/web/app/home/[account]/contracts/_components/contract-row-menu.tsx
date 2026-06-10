'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Download,
  FileText,
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
  deleteContract,
  generateInvoicesFromPaymentPlan,
  setContractStatus,
} from '../_lib/server/server-actions';

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
    payment_plan?: unknown;
  };
  canEditContracts: boolean;
  canManageContractStatus: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-zinc-700 bg-zinc-900">
        <DropdownMenuItem onClick={() => router.push(editPath)}>Open</DropdownMenuItem>
        {canEditContracts && contract.author_signed_at ? (
          <DropdownMenuItem onClick={() => router.push(`${editPath}?send=1`)}>
            <Send className="mr-2 h-4 w-4" />
            Send
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <a href={`/api/contracts/pdf?contractId=${contract.id}`} target="_blank" rel="noreferrer">
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
                () => generateInvoicesFromPaymentPlan({ accountId, contractId: contract.id }),
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
          <DropdownMenuItem
            onClick={() =>
              run(
                'cancel',
                () => setContractStatus({ accountId, contractId: contract.id, status: 'cancelled' }),
                'Contract cancelled',
              )
            }
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancel
          </DropdownMenuItem>
        ) : null}
        {canEditContracts && contract.status === 'draft' ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-400 focus:text-red-300"
              onClick={() =>
                run('delete', () => deleteContract({ accountId, contractId: contract.id }), 'Contract deleted')
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
