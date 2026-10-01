'use client';

import { useCallback, useRef, useState } from 'react';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type {
  PipelineData,
  PipelineDeal,
} from '~/home/(user)/_lib/server/pipeline.loader';
import type { PipelineListingOption } from '~/home/(user)/pipeline/_components/pipeline-board';
import { WonDealFollowUp } from '~/home/(user)/pipeline/_components/won-deal-follow-up';
import { createDisposalFromInstruction } from '~/home/[account]/listings/_lib/server/server-actions';
import type { ClientOption } from '~/home/[account]/projects/_components/client-combobox';
import type { CommercialRequirement } from '~/home/[account]/requirements/_lib/server/requirements.service';
import { DEFAULT_COMMERCIAL_WIP_BOARD_NAME } from '~/lib/commercial/commercial-constants';
import type { PipelineStageConfigItem } from '~/lib/commercial/pipeline-stage-config';
import type { WipLatestUpdate } from '~/lib/commercial/wip-latest-update';

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
  variant?: 'work' | 'commercial' | 'surveyor';
  listings?: PipelineListingOption[];
  stageConfig?: PipelineStageConfigItem[];
  boardName?: string;
  initialRequirements?: CommercialRequirement[];
  attentionDigest?: WipAttentionDigest | null;
  deskActivity?: WipDeskActivityItem[];
  latestCareByDealId?: Record<string, string>;
  latestUpdateByDealId?: Record<string, WipLatestUpdate>;
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
  latestUpdateByDealId = {},
  hideBoardTitle = false,
}: Props) {
  const router = useRouter();
  const [promptDeal, setPromptDeal] = useState<PipelineDeal | null>(null);
  const [wonDeal, setWonDeal] = useState<PipelineDeal | null>(null);

  // One disposal at a time: a second click while one is being built would
  // create a duplicate draft.
  const creatingDisposalRef = useRef(false);

  const openDisposalForm = useCallback(
    async (deal: PipelineDeal) => {
      if (creatingDisposalRef.current) {
        toast.info('A disposal is already being created, one moment…');
        return;
      }
      creatingDisposalRef.current = true;
      const toastId = toast.loading(
        `Creating a disposal from “${instructionTitle(deal)}”…`,
      );
      try {
        const { listingId } = await createDisposalFromInstruction({
          accountId,
          accountSlug,
          dealId: deal.id,
        });
        toast.success('Disposal created from the instruction', { id: toastId });
        router.push(
          pathsConfig.app.accountListingEdit
            .replace('[account]', accountSlug)
            .replace('[id]', listingId),
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not create the disposal',
          { id: toastId },
        );
      } finally {
        creatingDisposalRef.current = false;
      }
    },
    [accountId, accountSlug, router],
  );

  const handleDealWon = async (deal: PipelineDeal) => {
    if (variant === 'commercial') {
      setPromptDeal(deal);
      return;
    }

    if (variant === 'surveyor') {
      return;
    }

    setWonDeal(deal);
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
          latestUpdateByDealId={latestUpdateByDealId}
          onDealWon={handleDealWon}
          onRequestCreateDisposal={openDisposalForm}
          hideBoardTitle={hideBoardTitle}
        />
      ) : (
        <PipelineBoard
          initialData={initialData}
          onDealWon={handleDealWon}
          workspaceAccountSlug={accountSlug}
          workspaceAccountId={accountId}
          initialClients={initialClients}
          variant={variant === 'surveyor' ? 'surveyor' : 'work'}
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
      />
    </div>
  );
}
