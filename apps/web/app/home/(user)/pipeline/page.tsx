import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';

import { loadPipelineData } from '../_lib/server/pipeline.loader';
import { PipelineBoardWrapper } from './_components/pipeline-board-wrapper';

export const metadata = { title: 'Pipeline — Keel' };

export default function PipelinePage() {
  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)]">
      <Suspense fallback={<PipelineSkeleton />}>
        <PipelineContent />
      </Suspense>
    </PageBody>
  );
}

async function PipelineContent() {
  const data = await loadPipelineData();
  return <PipelineBoardWrapper initialData={data} />;
}

function PipelineSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-12 pt-6 md:px-6 lg:px-8">
      <div className="h-10 w-48 animate-pulse rounded-xl bg-white/[0.04]" />
      <div className="flex gap-4 overflow-x-auto">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex min-w-[260px] flex-1 flex-col gap-3">
            <div className="h-6 w-24 animate-pulse rounded-lg bg-white/[0.04]" />
            <div className="h-32 animate-pulse rounded-2xl bg-white/[0.04]" />
            <div className="h-32 animate-pulse rounded-2xl bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}
