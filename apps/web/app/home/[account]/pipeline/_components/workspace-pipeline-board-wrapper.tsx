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

import type {
  PipelineData,
  PipelineDeal,
} from '~/home/(user)/_lib/server/pipeline.loader';
import type { PipelineListingOption } from '~/home/(user)/pipeline/_components/pipeline-board';
import { WonDealFollowUp } from '~/home/(user)/pipeline/_components/won-deal-follow-up';
import { updateDeal } from '~/home/(user)/pipeline/actions';
import { ListingFormModal } from '~/home/[account]/listings/_components/listing-form-modal';
import type { CommercialListing } from '~/home/[account]/listings/_lib/server/listings.service';
import type { ClientOption } from '~/home/[account]/projects/_components/client-combobox';
import type { CommercialRequirement } from '~/home/[account]/requirements/_lib/server/requirements.service';
import { DEFAULT_COMMERCIAL_WIP_BOARD_NAME } from '~/lib/commercial/commercial-constants';
import type { PipelineStageConfigItem } from '~/lib/commercial/pipeline-stage-config';

import { instructionTitle } from '../_lib/instruction-title';
import type { WipDeskActivityItem } from '../_lib/server/wip-attachments.actions';
import type { WipAttentionDigest } from '../_lib/server/wip-attention.loader';
import { CompleteInstructionRegisterDialog } from './complete-instruction-register-dialog';

const PipelineBoard = dynamic(
  () =>
    import('~/home/(user)/pipeline/_components/pipeline-board').then(
      (mod) => mod.PipelineBoard,
    ),
  { ssr: false },
);

const CommercialWipBoard = dynamic(
  () => import('./commercial-wip-board').then((mod) => mod.CommercialWipBoard),
  { ssr: false },
);

type Props = {
  initialData: PipelineData;
  accountSlug: string;
  accountId: string;
  initialClients?: ClientOption[];
  variant?: 'work' | 'commercial';
  listings?: PipelineListingOption[];
  stageConfig?: PipelineStageConfigItem[];
  boardName?: string;
  initialRequirements?: CommercialRequirement[];
  attentionDigest?: WipAttentionDigest | null;
  deskActivity?: WipDeskActivityItem[];
  latestCareByDealId?: Record<string, string>;
  /** When true, rely on the page header for title/description. */
  hideBoardTitle?: boolean;
};

export function WorkspacePipelineBoardWrapper({
  initialData,
  accountSlug,
  accountId,
  initialClients = [],
  variant = 'work',
  listings = [],
  stageConfig,
  boardName = DEFAULT_COMMERCIAL_WIP_BOARD_NAME,
  initialRequirements = [],
  attentionDigest = null,
  deskActivity = [],
  latestCareByDealId = {},
  hideBoardTitle = false,
}: Props) {
  const router = useRouter();
  const [promptDeal, setPromptDeal] = useState<PipelineDeal | null>(null);
  const [wonDeal, setWonDeal] = useState<PipelineDeal | null>(null);
  const [newInstructionDeal, setNewInstructionDeal] =
    useState<PipelineDeal | null>(null);
  const [disposalDeal, setDisposalDeal] = useState<PipelineDeal | null>(null);

  const openDisposalForm = useCallback((deal: PipelineDeal) => {
    setPromptDeal(null);
    setNewInstructionDeal(null);
    setDisposalDeal(deal);
  }, []);

  const handleDealWon = async (deal: PipelineDeal) => {
    if (variant === 'commercial') {
      setPromptDeal(deal);
      return;
    }

    setWonDeal(deal);
  };

  const handleDisposalSaved = async (
    listing: CommercialListing,
    deal: PipelineDeal,
  ): Promise<void> => {
    await updateDeal(deal.id, {
      commercialListingId: listing.id,
      accountSlug,
    });
    setDisposalDeal(null);
    router.refresh();
  };

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col">
      {variant === 'commercial' ? (
        <CommercialWipBoard
          initialData={initialData}
          initialRequirements={initialRequirements}
          accountSlug={accountSlug}
          accountId={accountId}
          initialClients={initialClients}
          listings={listings}
          stageConfig={stageConfig}
          boardName={boardName}
          attentionDigest={attentionDigest}
          deskActivity={deskActivity}
          latestCareByDealId={latestCareByDealId}
          onDealWon={handleDealWon}
          onRequestCreateDisposal={openDisposalForm}
          onInstructionCreated={(deal) => setNewInstructionDeal(deal)}
          hideBoardTitle={hideBoardTitle}
        />
      ) : (
        <PipelineBoard
          initialData={initialData}
          onDealWon={handleDealWon}
          workspaceAccountSlug={accountSlug}
          workspaceAccountId={accountId}
          initialClients={initialClients}
          variant="work"
          hideBoardTitle={hideBoardTitle}
        />
      )}

      <WonDealFollowUp
        deal={wonDeal}
        accountId={accountId}
        accountSlug={accountSlug}
        onClose={() => setWonDeal(null)}
        onCompleted={() => {
          setWonDeal(null);
          router.refresh();
        }}
      />

      <CompleteInstructionRegisterDialog
        open={Boolean(promptDeal)}
        deal={promptDeal}
        accountId={accountId}
        accountSlug={accountSlug}
        onClose={() => setPromptDeal(null)}
        onRecorded={() => router.refresh()}
        onCreateDisposal={(deal) => {
          setPromptDeal(null);
          openDisposalForm(deal);
        }}
      />

      <AlertDialog
        open={Boolean(newInstructionDeal)}
        onOpenChange={(open) => {
          if (!open) setNewInstructionDeal(null);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Create a disposal?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--workspace-shell-text-muted)]">
              {newInstructionDeal
                ? `Link “${instructionTitle(newInstructionDeal)}” to a disposal now so marketing, viewings and the register stay connected.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (newInstructionDeal) openDisposalForm(newInstructionDeal);
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
          accountSlug={accountSlug}
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
