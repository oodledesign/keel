'use client';

import { useCallback, useState } from 'react';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';

import pathsConfig from '~/config/paths.config';
import type {
  PipelineData,
  PipelineDeal,
} from '~/home/(user)/_lib/server/pipeline.loader';
import type { PipelineListingOption } from '~/home/(user)/pipeline/_components/pipeline-board';
import { convertWonDealToProject, updateDeal } from '~/home/(user)/pipeline/actions';
import { ListingFormModal } from '~/home/[account]/listings/_components/listing-form-modal';
import type { CommercialListing } from '~/home/[account]/listings/_lib/server/listings.service';
import { DEFAULT_COMMERCIAL_WIP_BOARD_NAME } from '~/lib/commercial/commercial-constants';
import type { PipelineStageConfigItem } from '~/lib/commercial/pipeline-stage-config';

const PipelineBoard = dynamic(
  () =>
    import('~/home/(user)/pipeline/_components/pipeline-board').then(
      (mod) => mod.PipelineBoard,
    ),
  { ssr: false },
);

type Props = {
  initialData: PipelineData;
  accountSlug: string;
  accountId: string;
  variant?: 'work' | 'commercial';
  listings?: PipelineListingOption[];
  stageConfig?: PipelineStageConfigItem[];
  boardName?: string;
};

function instructionTitle(deal: PipelineDeal) {
  return (
    deal.companyName?.trim() ||
    deal.contactName?.trim() ||
    deal.clientName?.trim() ||
    'Untitled instruction'
  );
}

export function WorkspacePipelineBoardWrapper({
  initialData,
  accountSlug,
  accountId,
  variant = 'work',
  listings = [],
  stageConfig,
  boardName = DEFAULT_COMMERCIAL_WIP_BOARD_NAME,
}: Props) {
  const router = useRouter();
  const [promptDeal, setPromptDeal] = useState<PipelineDeal | null>(null);
  const [disposalDeal, setDisposalDeal] = useState<PipelineDeal | null>(null);

  const openDisposalForm = useCallback((deal: PipelineDeal) => {
    setPromptDeal(null);
    setDisposalDeal(deal);
  }, []);

  const handleDealWon = async (deal: PipelineDeal) => {
    if (variant === 'commercial') {
      if (!deal.commercialListingId) {
        setPromptDeal(deal);
      }
      return;
    }

    // Opportunity for an existing client → spin up a delivery project.
    if (deal.clientId) {
      const result = await convertWonDealToProject(deal.id);
      if (result.kind === 'project') {
        const projectUrl = `${pathsConfig.app.accountProjects.replace('[account]', result.accountSlug)}/${result.projectId}`;
        router.push(projectUrl);
        return;
      }
      if (result.kind === 'error') {
        // Leave the card as Won; nothing else to do automatically.
        return;
      }
    }

    // New lead → create a client prefilled from the deal.
    const params = new URLSearchParams({
      create: 'client',
      first_name: deal.contactName || '',
      company_name: deal.companyName || '',
    });
    const url = `${pathsConfig.app.accountClients.replace('[account]', accountSlug)}?${params.toString()}`;
    router.push(url);
  };

  const handleDisposalSaved = async (
    listing: CommercialListing,
    deal: PipelineDeal,
  ) => {
    await updateDeal(deal.id, {
      commercialListingId: listing.id,
      accountSlug,
    });
    setDisposalDeal(null);
    router.refresh();
  };

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col">
      <PipelineBoard
        initialData={initialData}
        onDealWon={handleDealWon}
        onRequestCreateDisposal={
          variant === 'commercial' ? openDisposalForm : undefined
        }
        workspaceAccountSlug={accountSlug}
        workspaceAccountId={accountId}
        variant={variant}
        listings={listings}
        stageConfig={stageConfig}
        boardName={boardName}
      />

      <AlertDialog
        open={Boolean(promptDeal)}
        onOpenChange={(open) => {
          if (!open) setPromptDeal(null);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Add as disposal?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--workspace-shell-text-muted)]">
              {promptDeal
                ? `“${instructionTitle(promptDeal)}” is Completed / Exchanged. Create a linked disposal now, or skip and do it later from the card menu.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (promptDeal) openDisposalForm(promptDeal);
              }}
            >
              Create disposal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {disposalDeal ? (
        <ListingFormModal
          open
          onClose={() => setDisposalDeal(null)}
          accountId={accountId}
          defaults={{
            name: instructionTitle(disposalDeal),
            askingRent:
              disposalDeal.value > 0 ? String(disposalDeal.value) : '',
            notes: disposalDeal.description?.trim() || '',
            status: 'draft',
          }}
          instructingClientId={disposalDeal.clientId}
          onSaved={(listing) => {
            void handleDisposalSaved(listing, disposalDeal);
          }}
        />
      ) : null}
    </div>
  );
}
