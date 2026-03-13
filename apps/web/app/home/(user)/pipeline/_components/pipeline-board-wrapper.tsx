'use client';

import { useRouter } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import type { PipelineData, PipelineDeal } from '../../_lib/server/pipeline.loader';
import { getDefaultAccountSlug } from '../actions';
import { PipelineBoard } from './pipeline-board';

type Props = { initialData: PipelineData };

export function PipelineBoardWrapper({ initialData }: Props) {
  const router = useRouter();

  const handleDealWon = async (deal: PipelineDeal) => {
    const result = await getDefaultAccountSlug();
    if (!result) return;
    const params = new URLSearchParams({
      create: 'client',
      first_name: deal.contactName || '',
      company_name: deal.companyName || '',
    });
    const url = `${pathsConfig.app.accountClients.replace('[account]', result.accountSlug)}?${params.toString()}`;
    router.push(url);
  };

  return (
    <PipelineBoard initialData={initialData} onDealWon={handleDealWon} />
  );
}
