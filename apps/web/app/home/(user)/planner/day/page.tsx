import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { loadPersonalDayViewData } from '~/lib/planner/load-planner-data';
import pathsConfig from '~/config/paths.config';

import { DayViewClient } from '../_components/DayViewClient';

export const metadata = { title: 'Today' };

interface PersonalPlannerDayPageProps {
  searchParams: Promise<{ date?: string }>;
}

async function PersonalPlannerDayPage({
  searchParams,
}: PersonalPlannerDayPageProps) {
  const { date } = await searchParams;
  const data = await loadPersonalDayViewData(date);

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-3 text-[var(--workspace-shell-text)] lg:px-0 lg:py-4">
      <DayViewClient
        initialData={data}
        dayViewHref={pathsConfig.app.personalPlannerDay}
      />
    </PageBody>
  );
}

export default withI18n(PersonalPlannerDayPage);
