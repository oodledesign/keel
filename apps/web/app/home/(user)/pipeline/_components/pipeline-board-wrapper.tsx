'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { toast } from '@kit/ui/sonner';

import type {
  PipelineData,
  PipelineDeal,
} from '../../_lib/server/pipeline.loader';
import { getDealWorkspace } from '../actions';
import { WonDealFollowUp } from './won-deal-follow-up';

const PipelineBoard = dynamic(
  () => import('./pipeline-board').then((mod) => mod.PipelineBoard),
  { ssr: false },
);

type Props = { initialData: PipelineData };

export function PipelineBoardWrapper({ initialData }: Props) {
  const router = useRouter();
  const [wonDeal, setWonDeal] = useState<PipelineDeal | null>(null);
  const [wonWorkspace, setWonWorkspace] = useState<{
    accountId: string;
    accountSlug: string;
  } | null>(null);

  const handleDealWon = async (deal: PipelineDeal) => {
    const workspace = await getDealWorkspace(deal.id);
    if (!workspace) {
      toast.error('Could not find a workspace for this lead.');
      return;
    }

    setWonWorkspace(workspace);
    setWonDeal(deal);
  };

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col">
      <PipelineBoard initialData={initialData} onDealWon={handleDealWon} />
      {wonWorkspace ? (
        <WonDealFollowUp
          deal={wonDeal}
          accountId={wonWorkspace.accountId}
          accountSlug={wonWorkspace.accountSlug}
          onClose={() => {
            setWonDeal(null);
            setWonWorkspace(null);
          }}
          onCompleted={() => {
            setWonDeal(null);
            setWonWorkspace(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
