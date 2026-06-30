'use client';

import { useRouter } from 'next/navigation';

import pathsConfig from '~/config/paths.config';

import type { PipelineData, PipelineDeal } from '../../_lib/server/pipeline.loader';
import { convertWonDealToProject, getDefaultAccountSlug } from '../actions';
import { PipelineBoard } from './pipeline-board';

type Props = { initialData: PipelineData };

export function PipelineBoardWrapper({ initialData }: Props) {
  const router = useRouter();

  const handleDealWon = async (deal: PipelineDeal) => {
    // Opportunity for an existing client → spin up a delivery project in its workspace.
    if (deal.clientId) {
      const converted = await convertWonDealToProject(deal.id);
      if (converted.kind === 'project') {
        const projectUrl = `${pathsConfig.app.accountProjects.replace('[account]', converted.accountSlug)}/${converted.projectId}`;
        router.push(projectUrl);
        return;
      }
      if (converted.kind === 'error') {
        return;
      }
    }

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
    <div className="flex min-h-full min-w-0 flex-1 flex-col">
      <PipelineBoard initialData={initialData} onDealWon={handleDealWon} />
    </div>
  );
}
