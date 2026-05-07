'use client';

import { useRouter } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import type { PipelineData, PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import { PipelineBoard } from '~/home/(user)/pipeline/_components/pipeline-board';

type Props = {
  initialData: PipelineData;
  accountSlug: string;
};

export function WorkspacePipelineBoardWrapper({
  initialData,
  accountSlug,
}: Props) {
  const router = useRouter();

  const handleDealWon = (deal: PipelineDeal) => {
    const params = new URLSearchParams({
      create: 'client',
      first_name: deal.contactName || '',
      company_name: deal.companyName || '',
    });
    const url = `${pathsConfig.app.accountClients.replace('[account]', accountSlug)}?${params.toString()}`;
    router.push(url);
  };

  return (
    <PipelineBoard
      initialData={initialData}
      onDealWon={handleDealWon}
      workspaceAccountSlug={accountSlug}
    />
  );
}
