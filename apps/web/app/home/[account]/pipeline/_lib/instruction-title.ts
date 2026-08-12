import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';

export function instructionTitle(deal: PipelineDeal) {
  return (
    deal.companyName?.trim() ||
    deal.contactName?.trim() ||
    deal.clientName?.trim() ||
    'Untitled instruction'
  );
}
