'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';

import {
  type SurveyorLeadContext,
  SurveyorLeadPanel,
} from './surveyor-lead-panel';

/** Full-page lead: the same two columns as the popup. */
export function SurveyorLeadPageClient({
  deal: initialDeal,
  context,
}: {
  deal: PipelineDeal;
  context: SurveyorLeadContext;
}) {
  const router = useRouter();
  const [deal, setDeal] = useState(initialDeal);

  return (
    <SurveyorLeadPanel
      context={context}
      deal={deal}
      layout="page"
      onSaved={(saved) => {
        setDeal(saved);
        router.refresh();
      }}
      onDealChange={setDeal}
    />
  );
}
