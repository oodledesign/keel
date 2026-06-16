import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import {
  assertWorkspacePlannerAccess,
  loadWorkspaceDayViewData,
} from '~/lib/planner/load-planner-data';
import pathsConfig from '~/config/paths.config';

import { DayViewClient } from '~/home/(user)/planner/_components/DayViewClient';

interface WorkspacePlannerDayPageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Today' };

async function WorkspacePlannerDayPage({ params }: WorkspacePlannerDayPageProps) {
  const accountSlug = (await params).account;

  try {
    await assertWorkspacePlannerAccess(accountSlug);
  } catch {
    redirect(pathsConfig.app.accountHome.replace('[account]', accountSlug));
  }

  const data = await loadWorkspaceDayViewData(accountSlug);
  const dayViewHref = pathsConfig.app.accountPlannerDay.replace(
    '[account]',
    accountSlug,
  );

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-white lg:px-6">
      <DayViewClient initialData={data} dayViewHref={dayViewHref} />
    </PageBody>
  );
}

export default withI18n(WorkspacePlannerDayPage);
