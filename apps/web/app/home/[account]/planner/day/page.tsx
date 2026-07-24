import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { DayViewClient } from '~/home/(user)/planner/_components/DayViewClient';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  assertWorkspacePlannerAccess,
  loadWorkspaceDayViewData,
} from '~/lib/planner/load-planner-data';

interface WorkspacePlannerDayPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ date?: string }>;
}

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Today' };

async function WorkspacePlannerDayPage({
  params,
  searchParams,
}: WorkspacePlannerDayPageProps) {
  const accountSlug = (await params).account;
  const { date } = await searchParams;

  try {
    await assertWorkspacePlannerAccess(accountSlug);
  } catch {
    redirect(pathsConfig.app.accountHome.replace('[account]', accountSlug));
  }

  const data = await loadWorkspaceDayViewData(accountSlug, date);
  const dayViewHref = pathsConfig.app.accountPlannerDay.replace(
    '[account]',
    accountSlug,
  );

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-3 text-[var(--workspace-shell-text)] lg:px-0 lg:py-4">
      <DayViewClient initialData={data} dayViewHref={dayViewHref} />
    </PageBody>
  );
}

export default withI18n(WorkspacePlannerDayPage);
