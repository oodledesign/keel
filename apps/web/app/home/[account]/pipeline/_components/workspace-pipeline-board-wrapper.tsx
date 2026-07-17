'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import pathsConfig from '~/config/paths.config';
import type {
  PipelineData,
  PipelineDeal,
} from '~/home/(user)/_lib/server/pipeline.loader';
import { convertWonDealToProject } from '~/home/(user)/pipeline/actions';

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
};

export function WorkspacePipelineBoardWrapper({
  initialData,
  accountSlug,
  accountId,
}: Props) {
  const router = useRouter();

  const handleDealWon = async (deal: PipelineDeal) => {
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

  return (
    <div className="flex min-h-full min-w-0 flex-1 flex-col">
      <PipelineBoard
        initialData={initialData}
        onDealWon={handleDealWon}
        workspaceAccountSlug={accountSlug}
        workspaceAccountId={accountId}
      />
    </div>
  );
}
