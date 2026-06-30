import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { PlannerPageClient } from '../_components/PlannerPageClient';
import { loadPlannerPageData } from '../_lib/server/planner.loader';

export const metadata = { title: 'Planner' };

async function PlannerPlanPage() {
  const data = await loadPlannerPageData();

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
      <PlannerPageClient initialData={data} />
    </PageBody>
  );
}

export default withI18n(PlannerPlanPage);
