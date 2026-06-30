import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { loadPersonalDayViewData } from '~/lib/planner/load-planner-data';
import pathsConfig from '~/config/paths.config';

import { DayViewClient } from '../_components/DayViewClient';

export const metadata = { title: 'Today' };

async function PersonalPlannerDayPage() {
  const data = await loadPersonalDayViewData();

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-6">
      <DayViewClient
        initialData={data}
        dayViewHref={pathsConfig.app.personalPlannerDay}
      />
    </PageBody>
  );
}

export default withI18n(PersonalPlannerDayPage);
