import { PageBody } from '@kit/ui/page';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { SchedulingNav } from './_components/scheduling-nav';
import { loadSchedulingAccess } from './_lib/server/scheduling-page.loader';

type Props = React.PropsWithChildren<{
  params: Promise<{ account: string }>;
}>;

export default async function SchedulingLayout({ children, params }: Props) {
  const { account } = await params;
  const { accountSlug } = await loadSchedulingAccess(account);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Scheduling"
        description="Public booking pages, availability, and meetings for this workspace."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <SchedulingNav accountSlug={accountSlug} />
        {children}
      </PageBody>
    </>
  );
}
