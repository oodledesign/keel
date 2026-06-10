'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Copy, Download, Loader2, MoreVertical, Send, Trash2 } from 'lucide-react';

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
  };
  canEditProposals: boolean;
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

  const editPath = pathsConfig.app.accountProposalEdit
    .replace('[account]', accountSlug)
    .replace('[id]', proposal.id);

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
        {canEditProposals ? (
          <DropdownMenuItem
            onClick={() =>
              run(
                'duplicate',
                () => duplicateProposalAction({ accountId, proposalId: proposal.id }),
                'Proposal duplicated',
              )
            }
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <a href={`/api/proposals/pdf?proposalId=${proposal.id}`} target="_blank" rel="noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Export to PDF
          </a>
        </DropdownMenuItem>
        {canEditProposals && ['sent', 'read'].includes(proposal.status) ? (
          <DropdownMenuItem
            onClick={() =>
              run(
                'resend',
                () => resendProposalAction({ accountId, proposalId: proposal.id }),
                'Proposal resent',
              )
            }
          >
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
                  () => deleteProposal({ accountId, proposalId: proposal.id }),
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
  );
}
